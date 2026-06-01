const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- MULTER CONFIG FOR DOCUMENTS ---
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'doc-' + uniqueSuffix + path.extname(file.originalname));
    },
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// ==========================================
// 1. POST: Register/Upgrade User to NGO
// ==========================================
router.post('/register', authMiddleware, async (req, res) => {
    const { 
        name, regNumber, country, address, 
        contactPerson, phone, description, userId,
        document_image 
    } = req.body;

    if (!name || !regNumber || !userId) {
        return res.status(400).json({ 
            success: false, 
            message: "NGO Name, Registration Number, and UserID are required." 
        });
    }

    try {
        // Fetch the user's email
        const user = await prisma.user.findUnique({
            where: { id: parseInt(userId) },
            select: { email: true },
        });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Upsert the NGO application
        await prisma.ngo_registrations.upsert({
            where: { user_id: parseInt(userId) },
            create: {
                name,
                reg_number: regNumber,
                country: country || 'Nepal',
                address: address || null,
                contact_person: contactPerson || null,
                phone: phone || null,
                email: user.email,
                description: description || null,
                user_id: parseInt(userId),
                status: 'pending',
                document_image: document_image || null,
            },
            update: {
                name,
                reg_number: regNumber,
                email: user.email,
                status: 'pending',
                country: country || 'Nepal',
                address: address || null,
                contact_person: contactPerson || null,
                phone: phone || null,
                description: description || null,
                document_image: document_image || null,
            },
        });

        // Update user role to ngo_pending
        await prisma.user.update({
            where: { id: parseInt(userId) },
            data: { role: 'ngo_pending' },
        });

        res.status(201).json({ success: true, message: "Registration submitted for approval." });

    } catch (err) {
        console.error("🔥 NGO Registration Error:", err.message);
        
        if (err.code === 'P2002') { 
            return res.status(400).json({ success: false, message: "This Reg Number is already in use by another NGO." });
        }
        res.status(500).json({ success: false, message: "Database error occurred." });
    }
});

// ==========================================
// 1.5. POST: Upload NGO Document
// ==========================================
router.post('/upload-document', authMiddleware, upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded." });
        }

        const filePath = `/uploads/${req.file.filename}`;
        
        // If it's for a user's general identity document
        await prisma.user.update({
            where: { id: req.user.id },
            data: { identity_document: filePath }
        });

        res.json({ 
            success: true, 
            message: "Document uploaded successfully.", 
            filePath: filePath 
        });
    } catch (err) {
        console.error("🔥 Document Upload Error:", err.message);
        res.status(500).json({ success: false, message: "Upload failed." });
    }
});

// ==========================================
// 2. GET: NGO verification status
// ==========================================
router.get('/status/:id', authMiddleware, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user id',
            });
        }

        const user = await prisma.user.findUnique({
            where: { id },
            select: { isVerified: true, role: true },
        });

        const registration = await prisma.ngo_registrations.findUnique({
            where: { user_id: id },
            select: { status: true, rejection_reason: true, document_image: true, name: true, reg_number: true, address: true, contact_person: true, phone: true, description: true }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        return res.json({
            success: true,
            status: registration ? registration.status : 'none',
            rejection_reason: registration ? registration.rejection_reason : null,
            role: user.role,
            registration: registration || null
        });
    } catch (err) {
        console.error('ngo status:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ==========================================
// 3. PUT: Admin Verify NGO
// ==========================================
router.put('/verify/:id', authMiddleware, requireRole('admin'), async (req, res) => {
    const { id } = req.params; 
    const { status, reason } = req.body; // 'verified', 'rejected', or 'reviewing'

    try {
        // Update the application status
        const updateData = { status };
        if (status === 'rejected') {
            updateData.rejection_reason = reason || "Application did not meet requirements.";
        } else {
            // Clear rejection reason if moving away from rejected state
            updateData.rejection_reason = null;
        }

        const registration = await prisma.ngo_registrations.update({
            where: { id: parseInt(id) },
            data: updateData,
        });

        if (!registration) {
            return res.status(404).json({ success: false, message: "Application not found." });
        }

        const userId = registration.user_id;

        // Update user role based on status
        if (status === 'verified') {
            await prisma.user.update({
                where: { id: userId },
                data: { role: 'ngo', isVerified: true },
            });
        } else if (status === 'rejected') {
            await prisma.user.update({
                where: { id: userId },
                data: { role: 'consumer', isVerified: false },
            });
        }

        res.json({ success: true, message: `NGO status updated to ${status}.` });
    } catch (err) {
        console.error("Verification Error:", err.message);
        res.status(500).json({ success: false, message: "Failed to update status." });
    }
});

// ==========================================
// ADMIN: Fetch NGO Applications (Filtered by Status)
// ==========================================
router.get('/admin/pending', authMiddleware, requireRole('admin'), async (req, res) => {
    try {
        const { status } = req.query;
        console.log(`📥 Admin fetching NGO requests (Status: ${status || 'pending/reviewing'})...`);
        
        const where = status 
            ? { status: status } 
            : { status: { in: ['pending', 'reviewing'] } };

        const applications = await prisma.ngo_registrations.findMany({
            where,
            include: {
                users: {
                    select: {
                        identity_document: true,
                    }
                }
            },
            orderBy: { created_at: 'desc' },
        });
        res.json({ success: true, data: applications });
    } catch (err) {
        console.error("🔥 Admin Fetch Error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;