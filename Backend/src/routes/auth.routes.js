const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const bcrypt = require("bcrypt");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const passport = require("passport");
const prisma = require("../lib/prisma");
const { sendResetEmail, sendTempPasswordEmail } = require("../services/emailService");
const { signUserToken } = require("../utils/authTokens");
const { authMiddleware } = require("../middleware/authMiddleware");

// --- MULTER CONFIG ---
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) { 
    fs.mkdirSync(uploadDir, { recursive: true }); 
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    cb(null, "brand-" + uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });

// ==========================================
// REGISTRATION (SIGNUP)
// ==========================================
router.post("/signup", async (req, res) => {
    console.log("\n--- 📝 Registration Attempt ---");
    console.log("Incoming Body:", JSON.stringify(req.body, null, 2));

    try {
        const userData = req.body.data || req.body || {};
        
        const fullName = userData.fullName || userData.full_name;
        const storeName = userData.storeName || userData.store_name;
        const email = userData.email;
        const password = userData.password;
        const phone = userData.phone;
        const role = userData.role;

        if (!email || !password) {
            console.log("❌ Rejected: Missing email or password");
            return res.status(400).json({ 
                success: false, 
                message: "Email and password are required" 
            });
        }

        const cleanEmail = email.toLowerCase().trim();
        const passwordStr = String(password);
        const hashedPassword = await bcrypt.hash(passwordStr, 10);

        // Check if email already exists
        const existing = await prisma.user.findUnique({
            where: { email: cleanEmail },
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: "Email already registered",
            });
        }
        
        const user = await prisma.user.create({
            data: {
                full_name: fullName || "New User",
                store_name: storeName || null,
                store_lat: userData.storeLat ? parseFloat(userData.storeLat) : null,
                store_lng: userData.storeLng ? parseFloat(userData.storeLng) : null,
                store_address: userData.storeAddress || null,
                email: cleanEmail,
                phone: phone || null,
                password: hashedPassword,
                role: role || "consumer",
            },
            select: {
                id: true,
                full_name: true,
                store_name: true,
                email: true,
                role: true,
                profile_image: true,
                cover_image: true,
                store_lat: true,
                store_lng: true,
                store_address: true,
                createdAt: true,
            },
        });

        // Generate JWT so user is logged in immediately after signup
        const token = signUserToken({
            id: user.id,
            email: user.email,
            role: user.role,
        });

        console.log(`✅ User Registered Successfully: ${cleanEmail} (ID: ${user.id})`);
        return res.status(201).json({ success: true, user, token });

    } catch (err) { 
        console.error("🔥 Signup Error Detail:", err.message);
        return res.status(500).json({ success: false, message: "Database error: " + err.message }); 
    }
});

// ==========================================
// LOGIN
// ==========================================
router.post("/login", async (req, res) => {
    console.log("\n--- 🛡️ Login Attempt ---");
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Missing email or password" });
        }

        const cleanEmail = email.toLowerCase().trim();

        const user = await prisma.user.findUnique({
            where: { email: cleanEmail },
        });

        if (!user) {
            console.log(`❌ No user found for: ${cleanEmail}`);
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        console.log(`[LOGIN] User ${user.id} (${cleanEmail}) — isBanned: ${user.isBanned}, hasPassword: ${!!user.password}`);

        if (user.isBanned) {
            console.log(`🚫 Banned user attempted login: ${cleanEmail}`);
            return res.status(403).json({
                success: false,
                message: "Your account has been suspended due to violation of our platform policies. Please contact support at support@saveabite.com.",
            });
        }

        if (!user.password) {
            return res.status(401).json({
                success: false,
                message: "This account uses Google sign-in. Please sign in with Google.",
            });
        }

        const isMatch = await bcrypt.compare(String(password), user.password);
        console.log(`🔑 Password Match Result: ${isMatch}`);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }
        
        // Remove sensitive fields from response
        const { password: _, resetToken: _rt, resetTokenExpiry: _re, ...safeUser } = user;

        // Generate JWT
        const token = signUserToken({
            id: user.id,
            email: user.email,
            role: user.role,
        });

        console.log(`✅ Login Success: ${cleanEmail}`);
        return res.json({ success: true, user: safeUser, token });

    } catch (err) { 
        console.error("🔥 Login Error:", err.message);
        return res.status(500).json({ success: false, message: "Server error during login" }); 
    }
});

// ==========================================
// UPDATE PROFILE (including location)
// ==========================================
router.put("/update-profile", authMiddleware, async (req, res) => {
    try {
        const { full_name, phone, store_name, store_lat, store_lng, store_address } = req.body;
        
        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },
            data: {
                full_name,
                phone,
                store_name,
                store_lat: store_lat ? parseFloat(store_lat) : null,
                store_lng: store_lng ? parseFloat(store_lng) : null,
                store_address,
            },
            select: {
                id: true,
                full_name: true,
                store_name: true,
                email: true,
                phone: true,
                role: true,
                isVerified: true,
                profile_image: true,
                cover_image: true,
                store_lat: true,
                store_lng: true,
                store_address: true,
                createdAt: true,
            },
        });

        return res.json({ success: true, user: updatedUser });
    } catch (err) {
        console.error("🔥 /update-profile Error:", err.message);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});

// ==========================================
// GET CURRENT USER (from token)
// ==========================================
router.get("/me", authMiddleware, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                full_name: true,
                store_name: true,
                email: true,
                phone: true,
                role: true,
                isVerified: true,
                profile_image: true,
                cover_image: true,
                store_lat: true,
                store_lng: true,
                store_address: true,
                createdAt: true,
            },
        });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        return res.json({ success: true, user });
    } catch (err) {
        console.error("🔥 /me Error:", err.message);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});

// ==========================================
// BRANDING
// ==========================================
router.post("/update-branding", authMiddleware, upload.single("image"), async (req, res) => {
    try {
        const { userId, type } = req.body; 
        if (!req.file) return res.status(400).json({ success: false, message: "No image uploaded" });
        
        const filePath = `/uploads/${req.file.filename}`;
        const column = type === 'profile' ? 'profile_image' : 'cover_image';
        
        await prisma.user.update({
            where: { id: parseInt(userId) },
            data: { [column]: filePath },
        });

        res.json({ success: true, path: filePath });
    } catch (err) { 
        console.error("🔥 Branding Error:", err.message);
        res.status(500).json({ success: false, message: err.message }); 
    }
});

// ==========================================
// GOOGLE OAUTH
// ==========================================
router.get("/google", (req, res, next) => {
    const { role, redirect_uri } = req.query;
    console.log("🔍 redirect_uri received:", redirect_uri); // ADD THIS

    const stateObj = { 
        role: role || 'consumer', 
        redirect_uri: redirect_uri || "saveabite-app://" 
    };
    const state = Buffer.from(JSON.stringify(stateObj)).toString('base64');
    
    passport.authenticate("google", { 
        scope: ["profile", "email"], 
        state: state,
        prompt: 'select_account' 
    })(req, res, next);
});

router.get("/google/callback", (req, res, next) => {
    passport.authenticate("google", { session: false }, (err, user) => {
        let stateData = null;
        try {
            if (req.query.state) {
                stateData = JSON.parse(
                    Buffer.from(req.query.state, "base64").toString()
                );
            }
        } catch (e) {
            console.error("Invalid OAuth state:", e);
        }

        const redirectBase = stateData?.redirect_uri || "saveabite://";

        if (err || !user) {
            console.error("❌ Google Auth Strategy Failed. Error:", err, "User:", user);
            const errMessage = err ? (err.message || String(err)) : "User not found or Strategy failed";
            const detailedErrorRedirect = `${redirectBase}${
                redirectBase.includes("?") ? "&" : "?"
            }error=${encodeURIComponent(errMessage)}`;
            return res.redirect(detailedErrorRedirect);
        }

        try {
            const redirectUri = stateData?.redirect_uri || "saveabite://";

            const {
                password: _pw,
                resetToken: _rt,
                resetTokenExpiry: _re,
                ...safeUser
            } = user;

            const token = signUserToken({
                id: user.id,
                email: user.email,
                role: user.role,
            });
            const tokenParam = encodeURIComponent(token);

            const connector = redirectUri.includes("?") ? "&" : "?";
            const finalRedirectUrl = `${redirectUri}${connector}token=${tokenParam}`;
            
            console.log("➡️ Redirecting to App with Token Only");
            
            res.setHeader("ngrok-skip-browser-warning", "any-value");
            return res.redirect(finalRedirectUrl);
        } catch (e) {
            console.error("❌ Google Callback Error:", e);
            const failRedirect = `${redirectBase}${
                redirectBase.includes("?") ? "&" : "?"
            }error=callback_failed`;
            return res.redirect(failRedirect);
        }
    })(req, res, next);
});

// ==========================================
// FORGOT PASSWORD
// ==========================================
router.post("/forgot-password", async (req, res) => {
    try {
        const raw = req.body.email;
        if (!raw || typeof raw !== "string") {
            return res.status(400).json({
                success: false,
                message: "Email is required",
            });
        }
        const cleanEmail = raw.toLowerCase().trim();

        const user = await prisma.user.findFirst({
            where: { email: { equals: cleanEmail, mode: "insensitive" } },
        });

        const generic = {
            success: true,
            message: "If that email is registered, a temporary password has been emailed to you.",
        };

        if (!user) {
            return res.json(generic);
        }

        // Generate a human-readable temporary password: SAB- followed by 6 random digits
        const tempPassword = "SAB-" + Math.floor(100000 + Math.random() * 900000);
        const hashedTempPassword = await bcrypt.hash(tempPassword, 10);

        // Update the user's password to the temporary password directly in the database
        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedTempPassword,
                resetToken: null,
                resetTokenExpiry: null,
            },
        });

        try {
            await sendTempPasswordEmail(user.email, tempPassword);
        } catch (mailErr) {
            console.error("sendTempPasswordEmail error:", mailErr);
            return res.status(500).json({
                success: false,
                message: "Failed to send temporary password email",
            });
        }

        return res.json(generic);
    } catch (err) {
        console.error("forgot-password:", err);
        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
});

// ==========================================
// RESET PASSWORD
// ==========================================
router.post("/reset-password/:token", async (req, res) => {
    try {
        const { token } = req.params;
        const newPassword = req.body.password ?? req.body.newPassword;

        if (!newPassword || String(newPassword).length < 8) {
            return res.status(400).json({
                success: false,
                message: "A new password of at least 8 characters is required",
            });
        }

        const user = await prisma.user.findFirst({
            where: { resetToken: token },
        });

        if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired reset link",
            });
        }

        const hashedPassword = await bcrypt.hash(String(newPassword), 10);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetToken: null,
                resetTokenExpiry: null,
            },
        });

        return res.json({
            success: true,
            message: "Password updated successfully",
        });
    } catch (err) {
        console.error("reset-password:", err);
        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
});

// ==========================================
// CHANGE PASSWORD (Secure, Logged-in)
// ==========================================
router.post("/change-password", authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Current password and new password are required",
            });
        }

        if (String(newPassword).length < 8) {
            return res.status(400).json({
                success: false,
                message: "New password must be at least 8 characters long",
            });
        }

        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
        });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // If user registered with Google and has no local password yet
        if (!user.password) {
            return res.status(400).json({
                success: false,
                message: "This account uses Google Sign-In. Password changes are managed through your Google account.",
            });
        }

        // Compare current password
        const isMatch = await bcrypt.compare(String(currentPassword), user.password);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "Incorrect current password",
            });
        }

        // Hash and save new password
        const hashedPassword = await bcrypt.hash(String(newPassword), 10);
        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword },
        });

        return res.json({
            success: true,
            message: "Password changed successfully",
        });
    } catch (err) {
        console.error("change-password:", err);
        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
});

// ==========================================
// REFRESH TOKEN (Update JWT if role changed)
// ==========================================
router.get("/refresh-token", authMiddleware, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, email: true, role: true }
        });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Generate a new token with the current role from DB
        const token = signUserToken({
            id: user.id,
            email: user.email,
            role: user.role,
        });

        return res.json({ success: true, token, user });
    } catch (err) {
        console.error("🔥 /refresh-token Error:", err.message);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});

module.exports = router;