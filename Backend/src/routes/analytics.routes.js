const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const { authMiddleware, requireRole } = require("../middleware/authMiddleware");

// ==========================================
// 1. BUSINESS ANALYTICS: Overview Stats
// ==========================================
router.get("/business/:storeId", authMiddleware, requireRole("business"), async (req, res) => {
  try {
    const storeId = parseInt(req.params.storeId);
    const now = new Date();

    // --- Time ranges ---
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);

    const monthStart = new Date(now);
    monthStart.setMonth(monthStart.getMonth() - 1);

    // --- Total listings ---
    const totalListings = await prisma.listings.count({
      where: { store_id: storeId },
    });

    const activeListings = await prisma.listings.count({
      where: { store_id: storeId, is_active: true, stock_quantity: { gt: 0 } },
    });

    // --- Orders (reservations) ---
    const totalOrders = await prisma.reservations.count({
      where: { listings: { store_id: storeId } },
    });

    const ordersToday = await prisma.reservations.count({
      where: {
        listings: { store_id: storeId },
        reserved_at: { gte: todayStart },
      },
    });

    const ordersThisWeek = await prisma.reservations.count({
      where: {
        listings: { store_id: storeId },
        reserved_at: { gte: weekStart },
      },
    });

    const completedOrders = await prisma.reservations.count({
      where: {
        listings: { store_id: storeId },
        status: "picked_up",
      },
    });

    const pendingOrders = await prisma.reservations.count({
      where: {
        listings: { store_id: storeId },
        status: "pending",
      },
    });

    // --- Revenue estimate (sum of selling_price for completed orders) ---
    const completedReservations = await prisma.reservations.findMany({
      where: {
        listings: { store_id: storeId },
        status: "picked_up",
      },
      include: {
        listings: { select: { selling_price: true } },
      },
    });

    const totalRevenue = completedReservations.reduce((sum, r) => {
      return sum + (parseFloat(r.listings?.selling_price) || 0);
    }, 0);

    const weekRevenue = completedReservations
      .filter((r) => r.reserved_at && new Date(r.reserved_at) >= weekStart)
      .reduce((sum, r) => {
        return sum + (parseFloat(r.listings?.selling_price) || 0);
      }, 0);

    // --- Surplus / Donation stats ---
    const totalDonations = await prisma.donations.count({
      where: { listings: { store_id: storeId } },
    });

    const donationsPickedUp = await prisma.donations.count({
      where: {
        listings: { store_id: storeId },
        status: "verified",
      },
    });

    // --- Top selling items ---
    const topItems = await prisma.reservations.groupBy({
      by: ["listing_id"],
      where: {
        listings: { store_id: storeId },
        status: "picked_up",
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    });

    // Fetch item names for top items
    const topItemDetails = await Promise.all(
      topItems.map(async (ti) => {
        const listing = await prisma.listings.findUnique({
          where: { id: ti.listing_id },
          select: { item_name: true, category: true, selling_price: true },
        });
        return {
          listing_id: ti.listing_id,
          item_name: listing?.item_name || "Unknown",
          category: listing?.category || "General",
          selling_price: listing?.selling_price || 0,
          total_sold: ti._count.id,
        };
      })
    );

    // --- Surplus trend (daily listing counts for the past 7 days) ---
    const surplusTrend = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const listingsCreated = await prisma.listings.count({
        where: {
          store_id: storeId,
          created_at: { gte: dayStart, lte: dayEnd },
        },
      });

      const ordersMade = await prisma.reservations.count({
        where: {
          listings: { store_id: storeId },
          reserved_at: { gte: dayStart, lte: dayEnd },
        },
      });

      surplusTrend.push({
        date: dayStart.toISOString().split("T")[0],
        day: dayStart.toLocaleDateString("en-US", { weekday: "short" }),
        listings_created: listingsCreated,
        orders: ordersMade,
      });
    }

    // --- Category breakdown ---
    const categoryBreakdown = await prisma.listings.groupBy({
      by: ["category"],
      where: { store_id: storeId },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    res.json({
      success: true,
      analytics: {
        overview: {
          total_listings: totalListings,
          active_listings: activeListings,
          total_orders: totalOrders,
          orders_today: ordersToday,
          orders_this_week: ordersThisWeek,
          completed_orders: completedOrders,
          pending_orders: pendingOrders,
        },
        revenue: {
          total: Math.round(totalRevenue),
          this_week: Math.round(weekRevenue),
        },
        donations: {
          total: totalDonations,
          picked_up: donationsPickedUp,
        },
        top_items: topItemDetails,
        surplus_trend: surplusTrend,
        category_breakdown: categoryBreakdown.map((c) => ({
          category: c.category,
          count: c._count.id,
        })),
      },
    });
  } catch (error) {
    console.error("ANALYTICS ERROR:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
