const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const prisma = require('../lib/prisma');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');
const {
  PROOF_WINDOW_MS,
  DONATION_STATUS,
  flagExpiredProofDonations,
  updateImpactStats,
  formatDonationRow,
} = require('../utils/donationHelpers');

const router = express.Router();

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const proofStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'donation-proof-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const uploadProof = multer({
  storage: proofStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

const certStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'certificate-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const uploadCert = multer({
  storage: certStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf' && !file.mimetype.startsWith('image/')) {
      return cb(new Error('Only PDF or image files are allowed for certificates'));
    }
    cb(null, true);
  },
});

const listingInclude = {
  listings: {
    include: {
      users: {
        select: {
          id: true,
          store_name: true,
          phone: true,
          profile_image: true,
        },
      },
    },
  },
  ngo: { select: { id: true, full_name: true } },
};

// ==========================================
// 1. GET: Available donations (for NGOs)
// ==========================================
router.get('/available', authMiddleware, requireRole('ngo'), async (req, res) => {
  try {
    const now = new Date();
    const donations = await prisma.donations.findMany({
      where: {
        status: DONATION_STATUS.AVAILABLE,
        listings: {
          OR: [{ ngo_expiry: { gt: now } }, { ngo_expiry: null }],
        },
      },
      include: listingInclude,
      orderBy: { created_at: 'desc' },
    });

    res.json({
      success: true,
      donations: donations.map(formatDonationRow),
    });
  } catch (error) {
    console.error('DONATIONS FETCH ERROR:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 2. PUT: NGO accepts a donation
// ==========================================
router.put('/:id/accept', authMiddleware, requireRole('ngo'), async (req, res) => {
  try {
    const donationId = parseInt(req.params.id);
    const ngoId = req.user.id;

    const donation = await prisma.donations.findUnique({
      where: { id: donationId },
    });

    if (!donation) {
      return res.status(404).json({ success: false, message: 'Donation not found' });
    }

    if (donation.status !== DONATION_STATUS.AVAILABLE) {
      return res.status(400).json({
        success: false,
        message: 'This donation is no longer available',
      });
    }

    const updated = await prisma.donations.update({
      where: { id: donationId },
      data: {
        ngo_id: ngoId,
        status: DONATION_STATUS.ACCEPTED,
        accepted_at: new Date(),
      },
      include: listingInclude,
    });

    res.json({
      success: true,
      message: 'Donation accepted! The restaurant will confirm when you pick up.',
      donation: formatDonationRow(updated),
    });
  } catch (error) {
    console.error('DONATION ACCEPT ERROR:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 3. PUT: Restaurant marks NGO picked up food
// ==========================================
router.put(
  '/:id/restaurant-pickup',
  authMiddleware,
  requireRole('business'),
  async (req, res) => {
    try {
      const donationId = parseInt(req.params.id);

      const donation = await prisma.donations.findUnique({
        where: { id: donationId },
        include: { listings: { select: { store_id: true } } },
      });

      if (!donation) {
        return res.status(404).json({ success: false, message: 'Donation not found' });
      }

      if (donation.listings?.store_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Not your store donation' });
      }

      if (donation.status !== DONATION_STATUS.ACCEPTED) {
        return res.status(400).json({
          success: false,
          message: 'Donation must be accepted by an NGO before marking picked up',
        });
      }

      const now = new Date();
      const proofDeadline = new Date(now.getTime() + PROOF_WINDOW_MS);

      const updated = await prisma.donations.update({
        where: { id: donationId },
        data: {
          status: DONATION_STATUS.PROOF_PENDING,
          picked_up_at: now,
          proof_deadline_at: proofDeadline,
        },
        include: listingInclude,
      });

      res.json({
        success: true,
        message:
          'Pickup recorded. The NGO must upload delivery proof within 24 hours.',
        donation: formatDonationRow(updated),
      });
    } catch (error) {
      console.error('RESTAURANT PICKUP ERROR:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ==========================================
// 4. POST: NGO uploads beneficiary proof photo
// ==========================================
router.post(
  '/:id/proof',
  authMiddleware,
  requireRole('ngo'),
  uploadProof.single('proof'),
  async (req, res) => {
    try {
      const donationId = parseInt(req.params.id);

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Proof photo is required',
        });
      }

      const donation = await prisma.donations.findUnique({
        where: { id: donationId },
      });

      if (!donation || donation.ngo_id !== req.user.id) {
        return res.status(404).json({
          success: false,
          message: 'Donation not found or not assigned to you',
        });
      }

      if (donation.status === DONATION_STATUS.DELIVERY_UNCONFIRMED) {
        return res.status(400).json({
          success: false,
          message: 'Proof deadline has passed. Delivery is marked as unconfirmed.',
        });
      }

      if (donation.status !== DONATION_STATUS.PROOF_PENDING) {
        return res.status(400).json({
          success: false,
          message: 'Waiting for the restaurant to confirm pickup first',
        });
      }

      const now = new Date();
      const proofImageUrl = `/uploads/${req.file.filename}`;

      const updated = await prisma.donations.update({
        where: { id: donationId },
        data: {
          status: DONATION_STATUS.VERIFIED,
          proof_image_url: proofImageUrl,
          proof_uploaded_at: now,
        },
        include: listingInclude,
      });

      try {
        await updateImpactStats(donation);
      } catch (impactErr) {
        console.error('Impact stats update failed (non-critical):', impactErr.message);
      }

      res.json({
        success: true,
        message: 'Delivery verified! Thank you for sharing proof.',
        donation: formatDonationRow(updated),
      });
    } catch (error) {
      console.error('DONATION PROOF UPLOAD ERROR:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ==========================================
// 5. NGO pickup disabled — restaurant confirms pickup
// ==========================================
router.put('/:id/pickup', authMiddleware, requireRole('ngo'), async (_req, res) => {
  return res.status(403).json({
    success: false,
    message:
      'NGOs cannot confirm pickup. The restaurant will mark the donation as picked up.',
  });
});

// ==========================================
// 6. GET: NGO donation history
// ==========================================
router.get('/my-donations', authMiddleware, requireRole('ngo'), async (req, res) => {
  try {
    const ngoId = req.user.id;
    await flagExpiredProofDonations({ ngo_id: ngoId });

    const donations = await prisma.donations.findMany({
      where: {
        ngo_id: ngoId,
        status: {
          in: [
            DONATION_STATUS.ACCEPTED,
            DONATION_STATUS.PROOF_PENDING,
            DONATION_STATUS.VERIFIED,
            DONATION_STATUS.DELIVERY_UNCONFIRMED,
          ],
        },
      },
      include: listingInclude,
      orderBy: { created_at: 'desc' },
    });

    res.json({
      success: true,
      donations: donations.map(formatDonationRow),
    });
  } catch (error) {
    console.error('MY DONATIONS ERROR:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 7. GET: Store donations (restaurant view + proof photos)
// ==========================================
router.get(
  '/store-donations',
  authMiddleware,
  requireRole('business'),
  async (req, res) => {
    try {
      const storeId = req.user.id;
      await flagExpiredProofDonations({
        listings: { store_id: storeId },
      });

      const donations = await prisma.donations.findMany({
        where: {
          listings: { store_id: storeId },
          status: {
            not: DONATION_STATUS.AVAILABLE,
          },
        },
        include: listingInclude,
        orderBy: { created_at: 'desc' },
      });

      res.json({
        success: true,
        donations: donations.map(formatDonationRow),
      });
    } catch (error) {
      console.error('STORE DONATIONS ERROR:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ==========================================
// 8. GET: Donation stats for a store
// ==========================================
router.get('/store-stats/:storeId', authMiddleware, async (req, res) => {
  try {
    const storeId = parseInt(req.params.storeId);

    const totalDonations = await prisma.donations.count({
      where: { listings: { store_id: storeId } },
    });

    const verified = await prisma.donations.count({
      where: {
        listings: { store_id: storeId },
        status: DONATION_STATUS.VERIFIED,
      },
    });

    const awaitingProof = await prisma.donations.count({
      where: {
        listings: { store_id: storeId },
        status: DONATION_STATUS.PROOF_PENDING,
      },
    });

    res.json({
      success: true,
      stats: {
        total_donations: totalDonations,
        verified,
        picked_up: verified,
        pending_proof: awaitingProof,
        pending: totalDonations - verified,
      },
    });
  } catch (error) {
    console.error('STORE DONATION STATS ERROR:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 9. POST: Restaurant requests a certificate
// ==========================================
router.post(
  '/:id/request-certificate',
  authMiddleware,
  requireRole('business'),
  async (req, res) => {
    try {
      const donationId = parseInt(req.params.id);

      const donation = await prisma.donations.findUnique({
        where: { id: donationId },
        include: { listings: { select: { store_id: true } } },
      });

      if (!donation) {
        return res.status(404).json({ success: false, message: 'Donation not found' });
      }

      if (donation.listings?.store_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Not your store donation' });
      }

      if (donation.status !== DONATION_STATUS.VERIFIED) {
        return res.status(400).json({
          success: false,
          message: 'Certificate can only be requested for fully verified donations',
        });
      }

      if (donation.certificate_requested) {
        return res.status(400).json({
          success: false,
          message: 'Certificate already requested for this donation',
        });
      }

      const updated = await prisma.donations.update({
        where: { id: donationId },
        data: {
          certificate_requested: true,
          certificate_requested_at: new Date(),
        },
      });

      res.json({
        success: true,
        message: 'Certificate request submitted. Admin will upload it shortly.',
        donation: updated,
      });
    } catch (error) {
      console.error('CERT REQUEST ERROR:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ==========================================
// 10. GET: Admin — all pending certificate requests
// ==========================================
router.get(
  '/certificate-requests',
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    try {
      const donations = await prisma.donations.findMany({
        where: {
          certificate_requested: true,
          certificate_url: null,
        },
        include: {
          listings: {
            include: {
              users: {
                select: { id: true, store_name: true, email: true, phone: true },
              },
            },
          },
          ngo: { select: { id: true, full_name: true } },
        },
        orderBy: { certificate_requested_at: 'asc' },
      });

      res.json({
        success: true,
        requests: donations.map((d) => ({
          id: d.id,
          item_name: d.listings?.item_name || 'Unknown',
          quantity: d.quantity,
          picked_up_at: d.picked_up_at,
          proof_image_url: d.proof_image_url,
          proof_uploaded_at: d.proof_uploaded_at,
          certificate_requested_at: d.certificate_requested_at,
          store: {
            id: d.listings?.users?.id,
            name: d.listings?.users?.store_name || 'Unknown Store',
            email: d.listings?.users?.email,
          },
          ngo_name: d.ngo?.full_name || null,
        })),
      });
    } catch (error) {
      console.error('CERT REQUESTS FETCH ERROR:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ==========================================
// 11. POST: Admin uploads certificate PDF/image
// ==========================================
router.post(
  '/:id/upload-certificate',
  authMiddleware,
  requireRole('admin'),
  uploadCert.single('certificate'),
  async (req, res) => {
    try {
      const donationId = parseInt(req.params.id);

      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Certificate file is required' });
      }

      const donation = await prisma.donations.findUnique({ where: { id: donationId } });

      if (!donation) {
        return res.status(404).json({ success: false, message: 'Donation not found' });
      }

      if (!donation.certificate_requested) {
        return res.status(400).json({
          success: false,
          message: 'No certificate request found for this donation',
        });
      }

      const certUrl = `/uploads/${req.file.filename}`;

      await prisma.donations.update({
        where: { id: donationId },
        data: { certificate_url: certUrl },
      });

      res.json({
        success: true,
        message: 'Certificate uploaded successfully.',
        certificate_url: certUrl,
      });
    } catch (error) {
      console.error('CERT UPLOAD ERROR:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

module.exports = router;
