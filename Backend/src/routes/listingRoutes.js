const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const prisma = require("../lib/prisma");
const { authMiddleware, requireRole } = require("../middleware/authMiddleware");
const { createNotification } = require("./notifications.routes");

// --- 1. MULTER CONFIGURATION ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "food-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// --- 2. GET ALL ACTIVE LISTINGS (public browsing) ---
router.get("/active", async (req, res) => {
  try {
    const { category, store_id, search, surprise } = req.query;

    const now = new Date();
    const where = {
      stock_quantity: { gt: 0 },
      is_active: true,
      AND: [
        {
          OR: [
            { rescue_deadline: { gt: now } },
            { rescue_deadline: null }
          ]
        }
      ]
    };

    if (category) where.category = category;
    if (store_id) where.store_id = parseInt(store_id);

    if (surprise === "true") {
      where.is_surprise_bag = true;
    } else if (surprise === "false") {
      where.is_surprise_bag = false;
    }

    if (search) {
      where.AND.push({
        OR: [
          { item_name: { contains: search, mode: "insensitive" } },
          { category: { contains: search, mode: "insensitive" } },
        ]
      });
    }

    const listings = await prisma.listings.findMany({
      where,
      include: {
        users: {
          select: {
            id: true,
            store_name: true,
            profile_image: true,
            cover_image: true,
            store_lat: true,
            store_lng: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    const formatted = listings.map((l) => ({
      id: l.id,
      store_id: l.store_id,
      item_name: l.item_name,
      category: l.category,
      original_price: l.original_price,
      selling_price: l.selling_price,
      discountPercent:
        Number(l.original_price) > 0
          ? Math.round(
              ((Number(l.original_price) - Number(l.selling_price)) /
                Number(l.original_price)) *
                100
            )
          : 0,
      is_surprise_bag: l.is_surprise_bag,
      dietary_preference: l.dietary_preference,
      health_note: l.health_note,
      rescue_deadline: l.rescue_deadline,
      auto_donate: l.auto_donate,
      image_url: l.image_url,
      created_at: l.created_at,
      stock_quantity: l.stock_quantity,
      is_active: l.is_active,
      store_name: l.users?.store_name || null,
      profile_image: l.users?.profile_image || null,
      cover_image: l.users?.cover_image || null,
      store_lat: l.users?.store_lat || null,
      store_lng: l.users?.store_lng || null,
    }));

    res.json({ success: true, listings: formatted });
  } catch (error) {
    console.error("FETCH ERROR:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- 3. GET PUBLIC STORE LISTINGS (Customer View) ---
router.get("/store-public/:storeId", async (req, res) => {
  try {
    const storeId = parseInt(req.params.storeId);

    const now = new Date();
    const listings = await prisma.listings.findMany({
      where: {
        store_id: storeId,
        is_active: true,
        stock_quantity: { gt: 0 },
        OR: [
          { rescue_deadline: { gt: now } },
          { rescue_deadline: null }
        ]
      },
      include: {
        users: {
          select: {
            store_name: true,
            profile_image: true,
            cover_image: true,
            store_lat: true,
            store_lng: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    const formatted = listings.map((l) => ({
      id: l.id,
      store_id: l.store_id,
      item_name: l.item_name,
      category: l.category,
      original_price: l.original_price,
      selling_price: l.selling_price,
      discountPercent:
        Number(l.original_price) > 0
          ? Math.round(
              ((Number(l.original_price) - Number(l.selling_price)) /
                Number(l.original_price)) *
                100
            )
          : 0,
      is_surprise_bag: l.is_surprise_bag,
      dietary_preference: l.dietary_preference,
      health_note: l.health_note,
      rescue_deadline: l.rescue_deadline,
      auto_donate: l.auto_donate,
      image_url: l.image_url,
      created_at: l.created_at,
      stock_quantity: l.stock_quantity,
      is_active: l.is_active,
      store_name: l.users?.store_name || null,
      profile_image: l.users?.profile_image || null,
      cover_image: l.users?.cover_image || null,
      store_lat: l.users?.store_lat || null,
      store_lng: l.users?.store_lng || null,
    }));

    res.json({ success: true, listings: formatted });
  } catch (error) {
    console.error("STORE PUBLIC LISTINGS ERROR:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- 4. GET MY LISTINGS (recommended for dashboard) ---
router.get("/my-listings", authMiddleware, requireRole("business"), async (req, res) => {
  try {
    const storeId = req.user.id;

    const listings = await prisma.listings.findMany({
      where: { store_id: storeId },
      orderBy: { created_at: "desc" },
    });

    res.json({ success: true, listings });
  } catch (error) {
    console.error("MY LISTINGS ERROR:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- 5. ADD NEW LISTING (Business only) ---
router.post("/add", authMiddleware, requireRole("business"), upload.single("image"), async (req, res) => {
  try {
    const {
      item_name,
      category,
      original_price,
      selling_price,
      stock_quantity,
      is_surprise_bag,
      dietary_preference,
      health_note,
      rescue_deadline,
      ngo_expiry,
      auto_donate,
    } = req.body;

    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    const listing = await prisma.listings.create({
      data: {
        item_name: item_name || null,
        store_id: req.user.id,
        category: category,
        original_price: parseFloat(original_price) || 0,
        selling_price: parseFloat(selling_price) || 0,
        stock_quantity: parseInt(stock_quantity) || 1,
        is_surprise_bag: is_surprise_bag === "true" || is_surprise_bag === true,
        dietary_preference: dietary_preference || "None",
        health_note: health_note || null,
        rescue_deadline: rescue_deadline || null,
        ngo_expiry: ngo_expiry || null,
        auto_donate: auto_donate === "true" || auto_donate === true,
        image_url: image_url,
      },
    });

    res.status(201).json({ success: true, message: "Published!", listing });
  } catch (error) {
    console.error("INSERT ERROR:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- 6. UPDATE LISTING (Business only + owner check) ---
router.put("/:id", authMiddleware, requireRole("business"), async (req, res) => {
  try {
    const listingId = parseInt(req.params.id);

    const existing = await prisma.listings.findUnique({
      where: { id: listingId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: "Listing not found" });
    }

    if (existing.store_id !== req.user.id) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const {
      item_name,
      category,
      original_price,
      selling_price,
      stock_quantity,
      is_surprise_bag,
      dietary_preference,
      health_note,
      rescue_deadline,
      ngo_expiry,
      auto_donate,
      is_active,
    } = req.body;

    const data = {};
    if (item_name !== undefined) data.item_name = item_name;
    if (category !== undefined) data.category = category;
    if (original_price !== undefined) data.original_price = parseFloat(original_price);
    if (selling_price !== undefined) data.selling_price = parseFloat(selling_price);
    if (stock_quantity !== undefined) data.stock_quantity = parseInt(stock_quantity);
    if (is_surprise_bag !== undefined) data.is_surprise_bag = is_surprise_bag === "true" || is_surprise_bag === true;
    if (dietary_preference !== undefined) data.dietary_preference = dietary_preference;
    if (health_note !== undefined) data.health_note = health_note;
    if (rescue_deadline !== undefined) data.rescue_deadline = rescue_deadline;
    if (ngo_expiry !== undefined) data.ngo_expiry = ngo_expiry;
    if (auto_donate !== undefined) data.auto_donate = auto_donate === "true" || auto_donate === true;
    if (is_active !== undefined) data.is_active = is_active === "true" || is_active === true;

    const listing = await prisma.listings.update({
      where: { id: listingId },
      data,
    });

    res.json({ success: true, message: "Updated!", listing });
  } catch (error) {
    console.error("UPDATE ERROR:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- 7. DELETE LISTING (Business only + owner check) ---
router.delete("/:id", authMiddleware, requireRole("business"), async (req, res) => {
  try {
    const listingId = parseInt(req.params.id);

    const existing = await prisma.listings.findUnique({
      where: { id: listingId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: "Listing not found" });
    }

    if (existing.store_id !== req.user.id) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    await prisma.listings.delete({
      where: { id: listingId },
    });

    res.json({ success: true, message: "Listing deleted." });
  } catch (error) {
    console.error("DELETE ERROR:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- 8. ORDER / PURCHASE ITEM ---
const handleOrder = async (req, res) => {
  const { listing_id } = req.body;
  const user_id = req.user.id;

  if (!listing_id) {
    return res.status(400).json({
      success: false,
      message: "listing_id is required",
    });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const listing = await tx.listings.findUnique({
        where: { id: parseInt(listing_id) },
      });

      if (!listing || listing.stock_quantity <= 0) {
        throw new Error("OUT_OF_STOCK");
      }

      const pickupCode = String(Math.floor(1000 + Math.random() * 9000));

      const order = await tx.reservations.create({
        data: {
          listing_id: parseInt(listing_id),
          user_id: user_id,
          status: "pending",
          pickup_code: pickupCode,
        },
      });

      await tx.listings.updateMany({
        where: { id: parseInt(listing_id), stock_quantity: { gt: 0 } },
        data: { stock_quantity: { decrement: 1 } },
      });

      return order;
    });

    res.json({
      success: true,
      message: "Order placed! Show your pickup code to collect.",
      order: result,
    });
  } catch (error) {
    if (error.message === "OUT_OF_STOCK") {
      return res.status(400).json({
        success: false,
        message: "Out of stock!",
      });
    }

    console.error("ORDER ERROR:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

router.post("/order", authMiddleware, handleOrder);
router.post("/reserve", authMiddleware, handleOrder);

// --- 9. CANCEL ORDER ---
const handleCancelOrder = async (req, res) => {
  const orderId = parseInt(req.params.id);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.reservations.findUnique({
        where: { id: orderId },
      });

      if (!order) throw new Error("NOT_FOUND");
      if (order.user_id !== req.user.id) throw new Error("FORBIDDEN");

      await tx.reservations.delete({
        where: { id: orderId },
      });

      await tx.listings.update({
        where: { id: order.listing_id },
        data: { stock_quantity: { increment: 1 } },
      });

      return order;
    });

    res.json({
      success: true,
      message: "Order cancelled. Stock restored.",
      order: result,
    });
  } catch (error) {
    if (error.message === "NOT_FOUND") {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (error.message === "FORBIDDEN") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    console.error("CANCELLATION ERROR:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

router.delete("/cancel-order/:id", authMiddleware, handleCancelOrder);
router.delete("/cancel-reservation/:id", authMiddleware, handleCancelOrder);

// --- 9.5. USER: Cancel a COD order (only available before a driver accepts) ---
router.post("/user-cancel/:id", authMiddleware, async (req, res) => {
  const orderId = parseInt(req.params.id);
  const userId = req.user.id;

  try {
    const reservation = await prisma.reservations.findUnique({
      where: { id: orderId },
    });

    if (!reservation) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (reservation.user_id !== userId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (reservation.payment_method !== "cod") {
      return res.status(400).json({
        success: false,
        message: "Only COD orders can be cancelled.",
      });
    }

    if (reservation.driver_id) {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel — a driver has already accepted this order.",
      });
    }

    if (!["pending", "confirmed"].includes(reservation.status)) {
      return res.status(400).json({
        success: false,
        message: "This order cannot be cancelled at its current stage.",
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.reservations.update({
        where: { id: orderId },
        data: { status: "cancelled" },
      });
      if (reservation.listing_id) {
        await tx.listings.update({
          where: { id: reservation.listing_id },
          data: { stock_quantity: { increment: 1 } },
        });
      }
    });

    return res.json({ success: true, message: "Order cancelled successfully." });
  } catch (error) {
    console.error("USER CANCEL ERROR:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- 10. CONFIRM PICKUP ---
router.put("/confirm-pickup/:id", authMiddleware, requireRole("business"), async (req, res) => {
  try {
    const reservationId = parseInt(req.params.id);
    const { pickup_code } = req.body;

    const reservation = await prisma.reservations.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      return res.status(404).json({ success: false, message: "Reservation not found" });
    }

    if (reservation.pickup_code !== pickup_code) {
      return res.status(400).json({ success: false, message: "Invalid pickup code" });
    }

    const updated = await prisma.reservations.update({
      where: { id: reservationId },
      data: {
        status: "picked_up",
        picked_up_at: new Date(),
      },
    });

    res.json({ success: true, message: "Pickup confirmed!", reservation: updated });
  } catch (error) {
    console.error("PICKUP CONFIRM ERROR:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- 11. GET ORDER HISTORY ---
const handleGetUserOrders = async (req, res) => {
  const userId = parseInt(req.params.user_id);

  try {
    if (userId !== req.user.id) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const orders = await prisma.reservations.findMany({
      where: { user_id: userId },
      include: {
        listings: {
          include: {
            users: {
              select: { store_name: true, phone: true },
            },
          },
        },
      },
      orderBy: { reserved_at: "desc" },
    });

    const formatted = orders.map((r) => ({
      order_id: r.id,
      status: r.status,
      ordered_at: r.reserved_at,
      pickup_code: r.pickup_code,
      picked_up_at: r.picked_up_at,
      delivered_at: r.delivered_at || null,
      order_type: r.order_type || "pickup",
      item_name: r.listings?.item_name || "Unknown Item",
      category: r.listings?.category || "General",
      image_url: r.listings?.image_url || null,
      selling_price: r.listings?.selling_price || 0,
      original_price: r.listings?.original_price || 0,
      store_name: r.listings?.users?.store_name || "Unknown Store",
      store_phone: r.listings?.users?.phone || null,
      is_surprise_bag: r.listings?.is_surprise_bag || false,
      // Driver info — only populated for delivery orders once a driver accepts
      driver_id: r.driver_id || null,
      driver_name: r.driver_name || null,
      driver_phone: r.driver_phone || null,
      driver_rating: r.driver_rating || null,
      payment_method: r.payment_method || "online",
    }));

    res.json({ success: true, orders: formatted });
  } catch (error) {
    console.error("FETCH ORDERS ERROR:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

router.get("/orders/:user_id", authMiddleware, handleGetUserOrders);
router.get("/user-reservations/:user_id", authMiddleware, handleGetUserOrders);

// --- 11.5. GET DRIVER ORDERS ---
router.get("/driver/orders", authMiddleware, async (req, res) => {
  try {
    const orders = await prisma.reservations.findMany({
      where: {
        order_type: "delivery",
        // "pending" = COD/direct orders, "confirmed" = Khalti-paid orders
        status: { in: ["pending", "confirmed"] },
        driver_id: null,
      },
      include: {
        listings: {
          include: {
            users: {
              select: {
                store_name: true,
                store_address: true,
                phone: true,
                store_lat: true,
                store_lng: true,
              },
            },
          },
        },
        users: {
          select: {
            full_name: true,
            phone: true,
          },
        },
      },
      orderBy: { reserved_at: "desc" },
    });

    const formatted = orders.map((r) => ({
      order_id: r.id,
      status: r.status,
      ordered_at: r.reserved_at,
      pickup_code: r.pickup_code,
      delivery_address: r.delivery_address || "N/A",
      delivery_fee: r.delivery_fee || 0,
      payment_method: r.payment_method || "online",
      item_name: r.listings?.item_name || "Surprise Bag",
      image_url: r.listings?.image_url || null,
      selling_price: r.listings?.selling_price || 0,
      store_name: r.listings?.users?.store_name || "Unknown Store",
      store_address: r.listings?.users?.store_address || "N/A",
      store_phone: r.listings?.users?.phone || null,
      store_lat: r.listings?.users?.store_lat || 27.7120,
      store_lng: r.listings?.users?.store_lng || 85.3120,
      customer_name: r.users?.full_name || "Unknown Customer",
      customer_phone: r.users?.phone || null,
      delivery_lat: r.delivery_lat || 27.7170,
      delivery_lng: r.delivery_lng || 85.3240,
    }));

    res.json({ success: true, orders: formatted });
  } catch (error) {
    console.error("DRIVER ORDERS ERROR:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- 11.6. GET DRIVER ACTIVE ORDER ---
router.get("/driver/active-order", authMiddleware, requireRole("driver"), async (req, res) => {
  try {
    const driverId = req.user.id;

    const reservation = await prisma.reservations.findFirst({
      where: {
        driver_id: driverId,
        status: { in: ["confirmed", "picked_up", "on_the_way"] },
      },
      include: {
        listings: {
          include: {
            users: {
              select: {
                store_name: true,
                store_address: true,
                phone: true,
                store_lat: true,
                store_lng: true,
              },
            },
          },
        },
        users: {
          select: { full_name: true, phone: true },
        },
      },
      orderBy: { reserved_at: "desc" },
    });

    if (!reservation) {
      return res.json({ success: true, order: null });
    }

    res.json({
      success: true,
      order: {
        order_id: reservation.id,
        status: reservation.status,
        delivery_address: reservation.delivery_address || "N/A",
        delivery_fee: reservation.delivery_fee || 0,
        payment_method: reservation.payment_method || "online",
        item_name: reservation.listings?.item_name || "Surprise Bag",
        selling_price: reservation.listings?.selling_price || 0,
        store_name: reservation.listings?.users?.store_name || "Unknown Store",
        store_address: reservation.listings?.users?.store_address || "N/A",
        store_phone: reservation.listings?.users?.phone || null,
        store_lat: reservation.listings?.users?.store_lat || 27.7120,
        store_lng: reservation.listings?.users?.store_lng || 85.3120,
        customer_name: reservation.users?.full_name || "Unknown Customer",
        customer_phone: reservation.users?.phone || null,
        delivery_lat: reservation.delivery_lat || 27.7170,
        delivery_lng: reservation.delivery_lng || 85.3240,
      },
    });
  } catch (error) {
    console.error("DRIVER ACTIVE ORDER ERROR:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- 11.7. GET DRIVER AVERAGE RATING ---
// Returns the average driver_rating from all completed deliveries for the current driver.
router.get("/driver/rating", authMiddleware, requireRole("driver"), async (req, res) => {
  try {
    const driverId = req.user.id;

    const result = await prisma.reservations.aggregate({
      where: {
        driver_id: driverId,
        driver_rating: { not: null },
      },
      _avg: { driver_rating: true },
      _count: { driver_rating: true },
    });

    const avg = result._avg.driver_rating;
    const count = result._count.driver_rating;

    res.json({
      success: true,
      average_rating: avg !== null ? parseFloat(avg.toFixed(1)) : null,
      rating_count: count,
    });
  } catch (error) {
    console.error("DRIVER RATING ERROR:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- 12. GET STORE ORDERS ---
router.get("/store-orders/:storeId", authMiddleware, requireRole("business"), async (req, res) => {
  const storeId = parseInt(req.params.storeId);

  try {
    const orders = await prisma.reservations.findMany({
      where: {
        listings: { store_id: storeId },
        status: { in: ["pending", "confirmed", "picked_up"] },
      },
      include: {
        listings: { select: { item_name: true, image_url: true, selling_price: true } },
        users: { select: { full_name: true, phone: true } },
      },
      orderBy: { reserved_at: "desc" },
    });

    const formatted = orders.map((r) => ({
      order_id: r.id,
      status: r.status,
      ordered_at: r.reserved_at,
      pickup_code: r.pickup_code,
      item_name: r.listings?.item_name || "Unknown Item",
      image_url: r.listings?.image_url || null,
      selling_price: r.listings?.selling_price || 0,
      customer_name: r.users?.full_name || "Unknown",
      customer_phone: r.users?.phone || null,
      order_type: r.order_type || "pickup",
    }));

    res.json({ success: true, orders: formatted });
  } catch (error) {
    console.error("STORE ORDERS ERROR:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/store-reservations/:storeId", authMiddleware, requireRole("business"), async (req, res) => {
  const storeId = parseInt(req.params.storeId);

  try {
    const orders = await prisma.reservations.findMany({
      where: {
        listings: { store_id: storeId },
        status: { in: ["pending", "confirmed"] },
      },
      include: {
        listings: { select: { item_name: true, image_url: true, selling_price: true } },
        users: { select: { full_name: true, phone: true } },
      },
      orderBy: { reserved_at: "desc" },
    });

    const formatted = orders.map((r) => ({
      order_id: r.id,
      status: r.status,
      ordered_at: r.reserved_at,
      pickup_code: r.pickup_code,
      item_name: r.listings?.item_name || "Unknown Item",
      image_url: r.listings?.image_url || null,
      selling_price: r.listings?.selling_price || 0,
      customer_name: r.users?.full_name || "Unknown",
      customer_phone: r.users?.phone || null,
      order_type: r.order_type || "pickup",
    }));

    res.json({ success: true, orders: formatted });
  } catch (error) {
    console.error("STORE RESERVATIONS ERROR:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- 13. DRIVER: Accept an order ---
router.put("/driver/accept/:id", authMiddleware, requireRole("driver"), async (req, res) => {
  const reservationId = parseInt(req.params.id);
  const driverId = req.user.id;

  try {
    const reservation = await prisma.reservations.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (reservation.order_type !== "delivery") {
      return res.status(400).json({ success: false, message: "This order is not a delivery order" });
    }

    if (reservation.driver_id) {
      return res.status(400).json({ success: false, message: "This order has already been accepted by a driver" });
    }

    // Fetch driver's name and phone
    const driver = await prisma.user.findUnique({
      where: { id: driverId },
      select: { full_name: true, phone: true },
    });

    const updated = await prisma.reservations.update({
      where: { id: reservationId },
      data: {
        driver_id: driverId,
        driver_name: driver?.full_name || null,
        driver_phone: driver?.phone || null,
        status: "confirmed",
      },
    });

    res.json({
      success: true,
      message: "Order accepted. Head to the pickup location.",
      order: updated,
    });

    // Notify the customer that a driver has been assigned
    if (reservation.user_id) {
      const driverName = driver?.full_name || "Your driver";
      const driverPhone = driver?.phone || "N/A";
      createNotification(
        prisma, reservation.user_id,
        "Driver Assigned",
        `${driverName} is picking up your order. Contact: ${driverPhone}`
      );
    }
  } catch (error) {
    console.error("DRIVER ACCEPT ERROR:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- 14. DRIVER: Start ride (on the way) ---
router.put("/driver/start-ride/:id", authMiddleware, requireRole("driver"), async (req, res) => {
  const reservationId = parseInt(req.params.id);
  const driverId = req.user.id;

  try {
    const reservation = await prisma.reservations.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (reservation.driver_id !== driverId) {
      return res.status(403).json({ success: false, message: "This is not your order" });
    }

    if (!["confirmed", "picked_up"].includes(reservation.status)) {
      return res.status(400).json({ success: false, message: "Order is not in a state that can be started" });
    }

    const updated = await prisma.reservations.update({
      where: { id: reservationId },
      data: { status: "on_the_way" },
    });

    res.json({
      success: true,
      message: "Ride started. The customer has been notified.",
      order: updated,
    });
  } catch (error) {
    console.error("DRIVER START RIDE ERROR:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- 15. DRIVER: Mark order as delivered ---
router.put("/driver/deliver/:id", authMiddleware, requireRole("driver"), async (req, res) => {
  const reservationId = parseInt(req.params.id);
  const driverId = req.user.id;

  try {
    const reservation = await prisma.reservations.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (reservation.driver_id !== driverId) {
      return res.status(403).json({ success: false, message: "This is not your order" });
    }

    const updated = await prisma.reservations.update({
      where: { id: reservationId },
      data: {
        status: "delivered",
        delivered_at: new Date(),
      },
    });

    res.json({
      success: true,
      message: "Delivery marked as complete.",
      order: updated,
    });

    // Notify the customer that their order has been delivered
    if (reservation.user_id) {
      createNotification(
        prisma, reservation.user_id,
        "Order Delivered",
        "Your order has been delivered. Enjoy your meal! 🎉"
      );
    }
  } catch (error) {
    console.error("DRIVER DELIVER ERROR:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- 15. USER: Rate a driver ---
router.put("/rate-driver/:id", authMiddleware, async (req, res) => {
  const reservationId = parseInt(req.params.id);
  const userId = req.user.id;
  const { rating } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, message: "Rating must be between 1 and 5" });
  }

  try {
    const reservation = await prisma.reservations.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (reservation.user_id !== userId) {
      return res.status(403).json({ success: false, message: "This is not your order" });
    }

    if (reservation.status !== "delivered") {
      return res.status(400).json({ success: false, message: "You can only rate a completed delivery" });
    }

    if (reservation.driver_rating) {
      return res.status(400).json({ success: false, message: "You have already rated this delivery" });
    }

    await prisma.reservations.update({
      where: { id: reservationId },
      data: { driver_rating: parseInt(rating) },
    });

    res.json({ success: true, message: "Thank you for your rating!" });
  } catch (error) {
    console.error("RATE DRIVER ERROR:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;