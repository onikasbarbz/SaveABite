const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

// ==========================================
// 1. GET: Global Impact Statistics
// ==========================================
router.get('/global', async (req, res) => {
  try {
    // Get current impact stats
    const impactStats = await prisma.impact_stats.findFirst({
      where: { id: 1 },
    });

    // Get total donations completed
    const totalDonations = await prisma.donations.count({
      where: { status: 'verified' },
    });

    // Get total meals saved from donations
    const totalMealsFromDonations = await prisma.donations.aggregate({
      where: { status: 'verified' },
      _sum: { quantity: true },
    });

    // Get total users by role
    const userStats = await prisma.user.groupBy({
      by: ['role'],
      _count: { id: true },
    });

    // Get total active listings
    const activeListings = await prisma.listings.count({
      where: { is_active: true, stock_quantity: { gt: 0 } },
    });

    // Get total stores (business users)
    const totalStores = await prisma.user.count({
      where: { role: 'business' },
    });

    // Get total NGOs
    const totalNgos = await prisma.user.count({
      where: { role: 'ngo' },
    });

    // Get recent donations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentDonations = await prisma.donations.count({
      where: {
        status: 'verified',
        proof_uploaded_at: { gte: thirtyDaysAgo },
      },
    });

    const recentMeals = await prisma.donations.aggregate({
      where: {
        status: 'verified',
        proof_uploaded_at: { gte: thirtyDaysAgo },
      },
      _sum: { quantity: true },
    });

    res.json({
      success: true,
      impact: {
        meals_saved: impactStats?.meals_saved || 0,
        kg_rescued: impactStats?.kg_rescued || 0,
        co2_reduced: impactStats?.co2_reduced || 0,
        total_donations_completed: totalDonations,
        meals_from_donations: totalMealsFromDonations._sum.quantity || 0,
      },
      community: {
        total_users: userStats.reduce((sum, stat) => sum + stat._count.id, 0),
        total_stores: totalStores,
        total_ngos: totalNgos,
        active_listings: activeListings,
        user_breakdown: userStats,
      },
      recent_activity: {
        donations_last_30_days: recentDonations,
        meals_last_30_days: recentMeals._sum.quantity || 0,
      },
    });
  } catch (error) {
    console.error('GLOBAL IMPACT ERROR:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 2. GET: Impact Trends (Last 12 months)
// ==========================================
router.get('/trends', async (req, res) => {
  try {
    const trends = [];

    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

      const donations = await prisma.donations.findMany({
        where: {
          status: 'verified',
          proof_uploaded_at: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
        select: { quantity: true },
      });

      const mealsSaved = donations.reduce((sum, d) => sum + d.quantity, 0);
      const kgRescued = mealsSaved * 0.5; // ~0.5kg per meal
      const co2Reduced = kgRescued * 2.5; // ~2.5kg CO₂ per kg food

      trends.push({
        month: monthStart.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
        meals_saved: mealsSaved,
        kg_rescued: kgRescued,
        co2_reduced: co2Reduced,
        donations_completed: donations.length,
      });
    }

    res.json({ success: true, trends });
  } catch (error) {
    console.error('IMPACT TRENDS ERROR:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 3. GET: Individual User Impact Statistics
// ==========================================
router.get('/user/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    // Get total completed reservations for this user
    const completedReservationsCount = await prisma.reservations.count({
      where: {
        user_id: userId,
        status: { in: ['pending', 'confirmed', 'picked_up'] },
      },
    });

    // Each bag/meal saved is ~0.5kg of food
    const kgRescued = completedReservationsCount * 0.5;
    
    // Each kg of food saved is ~2.5kg of CO2 reduced
    const co2Reduced = kgRescued * 2.5;

    res.json({
      success: true,
      stats: {
        bags_saved: completedReservationsCount,
        kg_rescued: parseFloat(kgRescued.toFixed(1)),
        co2_reduced: parseFloat(co2Reduced.toFixed(1)),
      }
    });
  } catch (error) {
    console.error('USER IMPACT ERROR:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;