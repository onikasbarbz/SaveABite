const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const prisma = require('../lib/prisma');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');
const { createNotification } = require('./notifications.routes');

// ── Multer setup ──────────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `ad-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

// ── Public: GET /api/ads ──────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const ads = await prisma.advertisements.findMany({
      where: { is_active: true },
      orderBy: { created_at: 'desc' },
    });
    res.json({ success: true, ads });
  } catch (err) {
    console.error('GET /api/ads error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch advertisements' });
  }
});

// ── Admin: GET /api/ads/admin ─────────────────────────────────────────────────
router.get('/admin', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const ads = await prisma.advertisements.findMany({
      orderBy: { created_at: 'desc' },
    });
    res.json({ success: true, ads });
  } catch (err) {
    console.error('GET /api/ads/admin error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch advertisements' });
  }
});

// ── Admin: POST /api/ads/admin ────────────────────────────────────────────────
// Expects multipart/form-data with a single field: image (file, required)
router.post('/admin', authMiddleware, requireRole('admin'), (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      console.error('Multer error on POST /api/ads/admin:', err);
      return res.status(400).json({ success: false, message: err.message || 'File upload failed' });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Poster image is required' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;

    const ad = await prisma.advertisements.create({
      data: {
        title: '',
        image_url: imageUrl,
        is_active: true,
      },
    });

    // Broadcast a notification to every consumer user (fire-and-forget)
    // Use prisma.user (singular) — Prisma model name is "User", not "users"
    prisma.user.findMany({
      where: { role: 'consumer' },
      select: { id: true },
    }).then((consumers) => {
      console.log(`[ads] Notification broadcast: found ${consumers.length} consumer(s) to notify`);
      return Promise.all(
        consumers.map((u) => {
          console.log(`[ads] Calling createNotification for user id=${u.id}`);
          return createNotification(
            prisma,
            u.id,
            'New Offer Available',
            'Check out our latest deals and offers on the SaveABite homepage.'
          );
        })
      );
    }).then((results) => {
      console.log(`[ads] Notification broadcast complete — ${results.length} notification(s) sent`);
    }).catch((err) => {
      console.error('POST /api/ads/admin — notification broadcast error:', err.message);
    });

    res.status(201).json({ success: true, ad });
  } catch (err) {
    console.error('POST /api/ads/admin error:', err);
    res.status(500).json({ success: false, message: 'Failed to create advertisement' });
  }
});

// ── Admin: PATCH /api/ads/admin/:id ──────────────────────────────────────────
router.patch('/admin/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid id' });

    const { is_active } = req.body;
    const data = {};
    if (is_active !== undefined) data.is_active = is_active === 'true' || is_active === true;

    const ad = await prisma.advertisements.update({ where: { id }, data });
    res.json({ success: true, ad });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Advertisement not found' });
    }
    console.error('PATCH /api/ads/admin/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to update advertisement' });
  }
});

// ── Admin: DELETE /api/ads/admin/:id ─────────────────────────────────────────
router.delete('/admin/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid id' });

    const ad = await prisma.advertisements.findUnique({ where: { id } });
    if (!ad) return res.status(404).json({ success: false, message: 'Advertisement not found' });

    if (ad.image_url) {
      const filePath = path.join(__dirname, '..', ad.image_url);
      fs.unlink(filePath, () => {});
    }

    await prisma.advertisements.delete({ where: { id } });
    res.json({ success: true, message: 'Advertisement deleted' });
  } catch (err) {
    console.error('DELETE /api/ads/admin/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete advertisement' });
  }
});

module.exports = router;
