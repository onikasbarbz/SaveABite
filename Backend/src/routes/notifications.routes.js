const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const { authMiddleware } = require("../middleware/authMiddleware");

/**
 * Internal helper — call this from other routes to create a notification.
 * Usage: await createNotification(prisma, userId, title, message)
 */
async function createNotification(db, userId, title, message) {
  try {
    await db.notifications.create({
      data: { user_id: userId, title, message },
    });
  } catch (e) {
    // Never let a notification failure break the main request
    console.error("NOTIFICATION CREATE ERROR:", e.message);
  }
}

module.exports.createNotification = createNotification;

// GET /api/notifications — fetch all notifications for the logged-in user
router.get("/", authMiddleware, async (req, res) => {
  try {
    const notifications = await prisma.notifications.findMany({
      where: { user_id: req.user.id },
      orderBy: { created_at: "desc" },
      take: 50,
    });

    const unreadCount = notifications.filter((n) => !n.is_read).length;

    res.json({ success: true, notifications, unread_count: unreadCount });
  } catch (error) {
    console.error("FETCH NOTIFICATIONS ERROR:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/notifications/read-all — mark all as read
router.patch("/read-all", authMiddleware, async (req, res) => {
  try {
    await prisma.notifications.updateMany({
      where: { user_id: req.user.id, is_read: false },
      data: { is_read: true },
    });
    res.json({ success: true });
  } catch (error) {
    console.error("MARK READ ERROR:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/notifications/:id/read — mark one as read
router.patch("/:id/read", authMiddleware, async (req, res) => {
  try {
    await prisma.notifications.updateMany({
      where: { id: parseInt(req.params.id), user_id: req.user.id },
      data: { is_read: true },
    });
    res.json({ success: true });
  } catch (error) {
    console.error("MARK ONE READ ERROR:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports.router = router;
