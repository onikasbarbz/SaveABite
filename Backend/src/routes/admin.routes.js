const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');

// ==========================================
// 1. GET: Admin Dashboard Overview
// ==========================================
router.get('/dashboard', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);

    const monthStart = new Date(now);
    monthStart.setMonth(monthStart.getMonth() - 1);

    // User statistics
    const totalUsers = await prisma.user.count();
    const usersToday = await prisma.user.count({
      where: { createdAt: { gte: todayStart } },
    });
    const usersThisWeek = await prisma.user.count({
      where: { createdAt: { gte: weekStart } },
    });
    const usersThisMonth = await prisma.user.count({
      where: { createdAt: { gte: monthStart } },
    });

    // User role breakdown
    const userRoles = await prisma.user.groupBy({
      by: ['role'],
      _count: { id: true },
    });

    // Listing statistics
    const totalListings = await prisma.listings.count();
    const activeListings = await prisma.listings.count({
      where: { is_active: true, stock_quantity: { gt: 0 } },
    });
    const listingsToday = await prisma.listings.count({
      where: { created_at: { gte: todayStart } },
    });

    // Reservation/Order statistics
    const totalReservations = await prisma.reservations.count();
    const reservationsToday = await prisma.reservations.count({
      where: { reserved_at: { gte: todayStart } },
    });
    const completedReservations = await prisma.reservations.count({
      where: { status: 'verified' },
    });

    // Donation statistics
    const totalDonations = await prisma.donations.count();
    const availableDonations = await prisma.donations.count({
      where: { status: 'available' },
    });
    const completedDonations = await prisma.donations.count({
      where: { status: 'verified' },
    });
    const donationsToday = await prisma.donations.count({
      where: { created_at: { gte: todayStart } },
    });

    // NGO applications
    const pendingNgos = await prisma.ngo_registrations.count({
      where: { status: 'pending' },
    });
    const verifiedNgos = await prisma.ngo_registrations.count({
      where: { status: 'verified' },
    });
    const totalNgoApplications = await prisma.ngo_registrations.count();

    // Revenue statistics (from completed reservations)
    const revenueData = await prisma.reservations.findMany({
      where: { status: 'verified' },
      include: {
        listings: { select: { selling_price: true } },
      },
    });

    const totalRevenue = revenueData.reduce((sum, r) => {
      return sum + (parseFloat(r.listings?.selling_price) || 0);
    }, 0);

    const revenueToday = revenueData
      .filter((r) => r.reserved_at && new Date(r.reserved_at) >= todayStart)
      .reduce((sum, r) => {
        return sum + (parseFloat(r.listings?.selling_price) || 0);
      }, 0);

    // Impact statistics
    const impactStats = await prisma.impact_stats.findFirst({
      where: { id: 1 },
    });

    // Recent activity (last 10 items)
    const recentReservations = await prisma.reservations.findMany({
      take: 10,
      orderBy: { reserved_at: 'desc' },
      select: {
        reserved_at: true,
        listings: {
          select: {
            item_name: true,
            users: {
              select: { store_name: true },
            },
          },
        },
        users: {
          select: { full_name: true },
        },
      },
    });

    const recentDonations = await prisma.donations.findMany({
      take: 10,
      orderBy: { created_at: 'desc' },
      select: {
        created_at: true,
        listings: {
          select: {
            item_name: true,
            users: {
              select: { store_name: true },
            },
          },
        },
        ngo: {
          select: { full_name: true },
        },
      },
    });

    res.json({
      success: true,
      dashboard: {
        users: {
          total: totalUsers,
          today: usersToday,
          this_week: usersThisWeek,
          this_month: usersThisMonth,
          by_role: userRoles,
        },
        listings: {
          total: totalListings,
          active: activeListings,
          today: listingsToday,
        },
        reservations: {
          total: totalReservations,
          today: reservationsToday,
          completed: completedReservations,
        },
        donations: {
          total: totalDonations,
          available: availableDonations,
          completed: completedDonations,
          today: donationsToday,
        },
        ngos: {
          pending: pendingNgos,
          verified: verifiedNgos,
          total_applications: totalNgoApplications,
        },
        revenue: {
          total: Math.round(totalRevenue * 100) / 100,
          today: Math.round(revenueToday * 100) / 100,
        },
        impact: {
          meals_saved: impactStats?.meals_saved || 0,
          kg_rescued: impactStats?.kg_rescued || 0,
          co2_reduced: impactStats?.co2_reduced || 0,
        },
        recent_activity: {
          reservations: recentReservations.map(r => ({
            id: r.id,
            item_name: r.listings?.item_name || 'Unknown',
            store_name: r.listings?.users?.store_name || 'Unknown Store',
            customer_name: r.users?.full_name || 'Unknown',
            reserved_at: r.reserved_at,
            status: r.status,
          })),
          donations: recentDonations.map(d => ({
            id: d.id,
            item_name: d.listings?.item_name || 'Unknown',
            store_name: d.listings?.users?.store_name || 'Unknown Store',
            ngo_name: d.users?.full_name || 'Unknown NGO',
            created_at: d.created_at,
            status: d.status,
          })),
        },
      },
    });
  } catch (error) {
    console.error('ADMIN DASHBOARD ERROR:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 2. GET: Admin Donations Data
// ==========================================
router.get('/donations', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 50, status, store_id, ngo_id } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (status) where.status = status;
    if (store_id) where.listings = { store_id: parseInt(store_id) };
    if (ngo_id) where.ngo_id = parseInt(ngo_id);

    const donations = await prisma.donations.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { created_at: 'desc' },
      include: {
        listings: {
          include: {
            users: {
              select: {
                id: true,
                store_name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        ngo: {
          select: {
            id: true,
            full_name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    const total = await prisma.donations.count({ where });

    const formatted = donations.map((d) => ({
      id: d.id,
      quantity: d.quantity,
      status: d.status,
      created_at: d.created_at,
      accepted_at: d.accepted_at,
      picked_up_at: d.picked_up_at,
      proof_image_url: d.proof_image_url || null,
      certificate_url: d.certificate_url || null,
      certificate_requested: d.certificate_requested || false,
      listing: {
        id: d.listing_id,
        item_name: d.listings?.item_name || 'Unknown',
        category: d.listings?.category || 'General',
        original_price: d.listings?.original_price || 0,
      },
      store: {
        id: d.listings?.users?.id,
        name: d.listings?.users?.store_name || 'Unknown Store',
        email: d.listings?.users?.email,
        phone: d.listings?.users?.phone,
      },
      ngo: d.ngo ? {
        id: d.ngo.id,
        name: d.ngo.full_name,
        email: d.ngo.email,
        phone: d.ngo.phone,
      } : null,
    }));

    res.json({
      success: true,
      donations: formatted,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('ADMIN DONATIONS ERROR:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 3. GET: Admin Users Data
// ==========================================
router.get('/users', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 50, role, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { full_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { store_name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        full_name: true,
        store_name: true,
        email: true,
        phone: true,
        role: true,
        isVerified: true,
        isBanned: true,
        profile_image: true,
        cover_image: true,
        createdAt: true,
      },
    });

    const total = await prisma.user.count({ where });

    res.json({
      success: true,
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('ADMIN USERS ERROR:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 4. GET: Admin Listings Data
// ==========================================
router.get('/listings', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 50, store_id, category, is_active } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (store_id) where.store_id = parseInt(store_id);
    if (category) where.category = category;
    if (is_active !== undefined) where.is_active = is_active === 'true';

    const listings = await prisma.listings.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { created_at: 'desc' },
      include: {
        users: {
          select: {
            id: true,
            store_name: true,
            email: true,
          },
        },
        _count: {
          select: {
            reservations: true,
            donations: true,
          },
        },
      },
    });

    const total = await prisma.listings.count({ where });

    const formatted = listings.map((l) => ({
      id: l.id,
      item_name: l.item_name,
      category: l.category,
      description: l.description,
      original_price: l.original_price,
      selling_price: l.selling_price,
      stock_quantity: l.stock_quantity,
      is_active: l.is_active,
      image_url: l.image_url,
      created_at: l.created_at,
      store: {
        id: l.users?.id,
        name: l.users?.store_name || 'Unknown Store',
        email: l.users?.email,
      },
      stats: {
        total_reservations: l._count.reservations,
        total_donations: l._count.donations,
      },
    }));

    res.json({
      success: true,
      listings: formatted,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('ADMIN LISTINGS ERROR:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 5. PATCH: Ban / Unban a user
// ==========================================
router.patch('/users/:id/ban', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    console.log(`[BAN] User ${userId} current isBanned: ${user.isBanned}`);

    // If the request body contains an explicit `ban` boolean, use it.
    // Otherwise fall back to toggling (legacy behaviour).
    const newBanState = typeof req.body.ban === 'boolean' ? req.body.ban : !user.isBanned;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isBanned: newBanState },
      select: { id: true, email: true, isBanned: true },
    });

    // Confirm the value that was actually persisted
    console.log(`[BAN] User ${updated.id} (${updated.email}) isBanned after update: ${updated.isBanned}`);

    res.json({
      success: true,
      message: updated.isBanned ? 'User banned.' : 'User unbanned.',
      is_banned: updated.isBanned,
    });
  } catch (error) {
    console.error('BAN USER ERROR:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 6. DELETE: Remove a user
// ==========================================
router.delete('/users/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    await prisma.user.delete({ where: { id: userId } });
    res.json({ success: true, message: 'User deleted.' });
  } catch (error) {
    console.error('DELETE USER ERROR:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 7. DELETE: Remove a listing
// ==========================================
router.delete('/listings/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const listingId = parseInt(req.params.id);
    await prisma.listings.delete({ where: { id: listingId } });
    res.json({ success: true, message: 'Listing deleted.' });
  } catch (error) {
    console.error('DELETE LISTING ERROR:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 8. GET: Analytics — trends, top stores, top NGOs
// ==========================================
router.get('/analytics', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { period = 'weekly' } = req.query;

    // Donation trend — last 8 weeks or 6 months
    const now = new Date();
    const buckets = [];
    const bucketCount = period === 'monthly' ? 6 : 8;

    for (let i = bucketCount - 1; i >= 0; i--) {
      const start = new Date(now);
      const end = new Date(now);
      if (period === 'monthly') {
        start.setMonth(start.getMonth() - i - 1);
        start.setDate(1); start.setHours(0, 0, 0, 0);
        end.setMonth(end.getMonth() - i);
        end.setDate(0); end.setHours(23, 59, 59, 999);
      } else {
        start.setDate(start.getDate() - (i + 1) * 7);
        start.setHours(0, 0, 0, 0);
        end.setDate(end.getDate() - i * 7);
        end.setHours(23, 59, 59, 999);
      }

      const count = await prisma.donations.count({
        where: { created_at: { gte: start, lte: end } },
      });

      const label = period === 'monthly'
        ? start.toLocaleString('en-US', { month: 'short', year: '2-digit' })
        : `W${bucketCount - i}`;

      buckets.push({ label, count });
    }

    // Top 10 restaurants by donation count
    const topStoresRaw = await prisma.donations.groupBy({
      by: ['listing_id'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 20,
    });

    const listingIds = topStoresRaw.map(r => r.listing_id);
    const listingsWithStore = await prisma.listings.findMany({
      where: { id: { in: listingIds } },
      select: { id: true, store_id: true, users: { select: { id: true, store_name: true } } },
    });

    // Aggregate by store
    const storeMap = {};
    for (const r of topStoresRaw) {
      const listing = listingsWithStore.find(l => l.id === r.listing_id);
      const storeId = listing?.users?.id;
      const storeName = listing?.users?.store_name || 'Unknown';
      if (!storeId) continue;
      storeMap[storeId] = {
        store_id: storeId,
        store_name: storeName,
        donation_count: (storeMap[storeId]?.donation_count || 0) + r._count.id,
      };
    }
    const topStores = Object.values(storeMap)
      .sort((a, b) => b.donation_count - a.donation_count)
      .slice(0, 10);

    // Top 10 NGOs by pickups received
    const topNgosRaw = await prisma.donations.groupBy({
      by: ['ngo_id'],
      where: { ngo_id: { not: null }, status: { in: ['proof_pending', 'verified'] } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const ngoIds = topNgosRaw.map(r => r.ngo_id).filter(Boolean);
    const ngoUsers = await prisma.user.findMany({
      where: { id: { in: ngoIds } },
      select: { id: true, full_name: true },
    });

    const topNgos = topNgosRaw.map(r => ({
      ngo_id: r.ngo_id,
      ngo_name: ngoUsers.find(u => u.id === r.ngo_id)?.full_name || 'Unknown NGO',
      pickup_count: r._count.id,
    }));

    res.json({ success: true, trend: buckets, top_stores: topStores, top_ngos: topNgos });
  } catch (error) {
    console.error('ANALYTICS ERROR:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 9. GET: Computed impact stats from real DB data
// ==========================================
router.get('/impact-computed', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now);
    monthStart.setMonth(monthStart.getMonth() - 1);

    // Completed orders (confirmed/delivered/picked_up)
    const completedOrders = await prisma.reservations.count({
      where: { status: { in: ['confirmed', 'delivered', 'picked_up', 'on_the_way'] } },
    });

    // Completed donations
    const completedDonations = await prisma.donations.count({
      where: { status: { in: ['proof_pending', 'verified'] } },
    });

    // Total meals saved = completed orders + completed donations
    const mealsSaved = completedOrders + completedDonations;

    // Kg rescued — estimate 0.5 kg per meal
    const kgRescued = Math.round(mealsSaved * 0.5 * 10) / 10;

    // CO2 reduced — 1 kg food = 2.5 kg CO2
    const co2Reduced = Math.round(kgRescued * 2.5 * 10) / 10;

    // Total revenue from all confirmed/delivered orders
    const revenueOrders = await prisma.reservations.findMany({
      where: { status: { in: ['confirmed', 'delivered', 'picked_up', 'on_the_way'] } },
      include: { listings: { select: { selling_price: true } } },
    });
    const totalRevenue = revenueOrders.reduce((sum, r) => sum + (parseFloat(r.listings?.selling_price) || 0), 0);

    // Active users this month (placed an order or registered)
    const activeUsersThisMonth = await prisma.user.count({
      where: { createdAt: { gte: monthStart } },
    });

    // Top performing stores by order count
    const topStoresRaw = await prisma.reservations.groupBy({
      by: ['listing_id'],
      where: { status: { in: ['confirmed', 'delivered', 'picked_up'] } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 20,
    });

    const listingIds = topStoresRaw.map(r => r.listing_id).filter(Boolean);
    const listingsForStores = await prisma.listings.findMany({
      where: { id: { in: listingIds } },
      select: { id: true, users: { select: { id: true, store_name: true } } },
    });

    const storeOrderMap = {};
    for (const r of topStoresRaw) {
      const listing = listingsForStores.find(l => l.id === r.listing_id);
      const storeId = listing?.users?.id;
      const storeName = listing?.users?.store_name || 'Unknown';
      if (!storeId) continue;
      storeOrderMap[storeId] = {
        store_id: storeId,
        store_name: storeName,
        order_count: (storeOrderMap[storeId]?.order_count || 0) + r._count.id,
      };
    }
    const topStores = Object.values(storeOrderMap)
      .sort((a, b) => b.order_count - a.order_count)
      .slice(0, 5);

    res.json({
      success: true,
      stats: {
        meals_saved: mealsSaved,
        kg_rescued: kgRescued,
        co2_reduced: co2Reduced,
        total_donations_completed: completedDonations,
        total_orders_completed: completedOrders,
        total_revenue: Math.round(totalRevenue * 100) / 100,
        active_users_this_month: activeUsersThisMonth,
        top_stores: topStores,
      },
    });
  } catch (error) {
    console.error('IMPACT COMPUTED ERROR:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
