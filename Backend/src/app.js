require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const prisma = require("./lib/prisma");
const authRoutes = require("./routes/auth.routes");
const listingRoutes = require("./routes/listingRoutes");
const ngoRoutes = require("./routes/ngo.routes");
const donationRoutes = require("./routes/donation.routes");
const analyticsRoutes = require("./routes/analytics.routes");
const paymentRoutes = require("./routes/payment.routes");
const impactRoutes = require("./routes/impact.routes");
const adminRoutes = require("./routes/admin.routes");
const { router: notificationRoutes } = require("./routes/notifications.routes");
const adsRoutes = require("./routes/ads.routes");
const { startAutoDonateJob } = require("./jobs/autoDonateJob");
const { startDonationProofJob } = require("./jobs/donationProofJob");

const app = express();

// --- MIDDLEWARE ---
app.use(cors({ origin: "*" }));
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});
app.use(express.urlencoded({ extended: true })); // <-- CRITICAL: Added this
app.use(passport.initialize());

/**
 * GOOGLE OAUTH STRATEGY
 */
const googleCallbackURL = process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/api/auth/google/callback";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: googleCallbackURL,
      proxy: true,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const googleId = profile.id;
        const fullName = profile.displayName;
        const profilePic = profile.photos?.[0]?.value ?? null;

        let role = "consumer";
        try {
          if (req.query?.state) {
            const stateData = JSON.parse(
              Buffer.from(req.query.state, "base64").toString()
            );
            if (stateData.role) role = String(stateData.role);
          }
        } catch (_) {
          /* keep default role */
        }

        let user = await prisma.user.findFirst({
          where: { OR: [{ googleId }, { email }] },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              full_name: fullName,
              email,
              phone: null,
              role,
              password: null,
              profile_image: profilePic,
              googleId,
            },
          });
        } else {
          const data = {};
          if (!user.googleId) data.googleId = googleId;
          if (profilePic && !user.profile_image) data.profile_image = profilePic;
          if (Object.keys(data).length > 0) {
            user = await prisma.user.update({
              where: { id: user.id },
              data,
            });
          }
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

/**
 * STATIC FILE SERVING
 */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/**
 * ROUTES
 */
app.use("/api/auth", authRoutes);
app.use("/api/listings", listingRoutes);
app.use("/api/ngo", ngoRoutes);
app.use("/api/donations", donationRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/impact", impactRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/ads", adsRoutes);

app.get("/", (req, res) => {
  res.json({ success: true, message: "RescueFood API is live" });
});

/**
 * 🛡️ GLOBAL ERROR HANDLER
 * This prevents the "Unexpected character T" error on the frontend.
 */
app.use((err, req, res, next) => {
  console.error("🚨 SERVER CRASH DETECTED:");
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    error: err.message
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("-------------------------------------------");
  console.log("🚀 SaveABite Backend: ONLINE");
  console.log(`📡 Local:    http://localhost:${PORT}`);
  console.log(`📱 Emulator: http://10.0.2.2:${PORT}`);
  console.log("-------------------------------------------");

  startAutoDonateJob();
  startDonationProofJob();
});