const express = require("express");
const router = express.Router();
const axios = require("axios");
const prisma = require("../lib/prisma");
const { authMiddleware } = require("../middleware/authMiddleware");
const { createNotification } = require("./notifications.routes");

const KHALTI_BASE = "https://dev.khalti.com/api/v2/epayment";

router.post("/initiate", authMiddleware, async (req, res) => {
  try {
    const { listing_id, order_type, delivery_lat, delivery_lng, delivery_address, delivery_fee } = req.body;
    const user_id = req.user.id;

    const listing = await prisma.listings.findUnique({
      where: { id: parseInt(listing_id) },
      include: { users: { select: { store_name: true } } },
    });

    if (!listing) return res.status(404).json({ success: false, message: "Listing not found" });
    if (listing.stock_quantity <= 0) return res.status(400).json({ success: false, message: "Out of stock!" });

    const itemPrice = parseFloat(listing.selling_price);
    const fee = order_type === 'delivery' ? parseFloat(delivery_fee || 0) : 0;
    const totalAmount = itemPrice + fee;
    const amountInPaisa = Math.round(totalAmount * 100);
    const itemName = listing.item_name || "Surprise Bag";
    const storeName = listing.users?.store_name || "SaveABite Store";

    const order = await prisma.reservations.create({
      data: {
        listing_id: parseInt(listing_id),
        user_id: user_id,
        status: "payment_pending",
        pickup_code: String(Math.floor(1000 + Math.random() * 9000)),
        order_type: order_type || "pickup",
        delivery_lat: order_type === 'delivery' ? parseFloat(delivery_lat) : null,
        delivery_lng: order_type === 'delivery' ? parseFloat(delivery_lng) : null,
        delivery_address: order_type === 'delivery' ? delivery_address : null,
        delivery_fee: fee,
      },
    });

    const backendBase = process.env.KHALTI_RETURN_URL || `http://localhost:5000/api/payment/return`;
    const returnUrl = `${backendBase}?order_id=${order.id}`;

    const khaltiResponse = await axios.post(
      `${KHALTI_BASE}/initiate/`,
      {
        return_url: returnUrl,
        website_url: process.env.KHALTI_RETURN_URL ? process.env.KHALTI_RETURN_URL.replace(/\/api\/payment\/return$/, '') : "http://localhost:5000",
        amount: amountInPaisa,
        purchase_order_id: `ORDER-${order.id}`,
        purchase_order_name: `${itemName} from ${storeName}`,
        customer_info: { name: req.user.email, email: req.user.email },
      },
      { headers: { Authorization: `Key ${process.env.KHALTI_SECRET_KEY}`, "Content-Type": "application/json" } }
    );

    const { pidx, payment_url } = khaltiResponse.data;

    await prisma.reservations.update({ where: { id: order.id }, data: { status: "payment_pending" } });

    res.json({ success: true, order_id: order.id, pidx, payment_url, amount: amountInPaisa });
  } catch (error) {
    console.error("KHALTI INITIATE ERROR:", error.response?.data || error.message);
    res.status(500).json({ success: false, message: "Payment initiation failed", error: error.response?.data?.detail || error.message });
  }
});

router.get("/return", async (req, res) => {
  const { pidx, order_id } = req.query;
  const deepLink = `saveabite-app://payment/verify?pidx=${pidx || ""}&order_id=${order_id || ""}`;
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Returning to SaveABite...</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #244F42 0%, #1a3a30 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; color: white; }
        .container { text-align: center; padding: 40px 30px; max-width: 400px; }
        .checkmark { width: 80px; height: 80px; background: rgba(255,255,255,0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; font-size: 40px; }
        h1 { font-size: 24px; margin-bottom: 12px; font-weight: 700; }
        p { font-size: 16px; opacity: 0.85; margin-bottom: 30px; line-height: 1.5; }
        .spinner { width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.2); border-top-color: #F4A71D; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 24px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .btn { display: inline-block; background: #F4A71D; color: #244F42; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px; }
        .note { margin-top: 20px; font-size: 13px; opacity: 0.6; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="checkmark">✅</div>
        <h1>Payment Complete!</h1>
        <p>Returning you to SaveABite to confirm your order...</p>
        <div class="spinner"></div>
        <a href="${deepLink}" class="btn">Tap here if not redirected</a>
        <p class="note">You'll be taken back to the app automatically.</p>
      </div>
      <script>setTimeout(function() { window.location.href = "${deepLink}"; }, 1500);</script>
    </body>
    </html>
  `);
});

router.post("/verify", authMiddleware, async (req, res) => {
  try {
    const { pidx, order_id } = req.body;
    if (!pidx || !order_id) return res.status(400).json({ success: false, message: "pidx and order_id are required" });

    const verifyResponse = await axios.post(
      `${KHALTI_BASE}/lookup/`,
      { pidx },
      { headers: { Authorization: `Key ${process.env.KHALTI_SECRET_KEY}`, "Content-Type": "application/json" } }
    );

    const paymentData = verifyResponse.data;
    console.log("Khalti Verification Response:", paymentData);

    if (paymentData.status === "Completed") {
      const result = await prisma.$transaction(async (tx) => {
        const order = await tx.reservations.findUnique({ where: { id: parseInt(order_id) } });
        if (!order) throw new Error("ORDER_NOT_FOUND");
        const updatedOrder = await tx.reservations.update({ where: { id: parseInt(order_id) }, data: { status: "confirmed" } });
        await tx.listings.updateMany({ where: { id: order.listing_id, stock_quantity: { gt: 0 } }, data: { stock_quantity: { decrement: 1 } } });
        return updatedOrder;
      });

      // Notify user: order confirmed + payment received
      const amountNPR = Math.round((paymentData.total_amount || 0) / 100);
      const paidAt = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      await createNotification(prisma, result.user_id, "Order Confirmed", `Your order #${result.id} has been confirmed.`);
      await createNotification(prisma, result.user_id, "Payment Received", `NPR ${amountNPR} paid at ${paidAt}.`);

      res.json({ success: true, message: "Payment verified! Your order is confirmed.", order: result, payment: { status: paymentData.status, amount: paymentData.total_amount, transaction_id: paymentData.transaction_id } });
    } else if (paymentData.status === "Pending") {
      res.json({ success: false, message: "Payment is still pending. Please complete the payment.", payment_status: paymentData.status });
    } else {
      await prisma.reservations.update({ where: { id: parseInt(order_id) }, data: { status: "failed" } });
      res.json({ success: false, message: "Payment failed or was cancelled.", payment_status: paymentData.status });
    }
  } catch (error) {
    console.error("KHALTI VERIFY ERROR:", error.response?.data || error.message);
    res.status(500).json({ success: false, message: "Payment verification failed", error: error.response?.data?.detail || error.message });
  }
});

router.post("/cancel", authMiddleware, async (req, res) => {
  try {
    const { order_id } = req.body;
    const order = await prisma.reservations.findUnique({ where: { id: parseInt(order_id) } });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (order.status !== "payment_pending") return res.status(400).json({ success: false, message: "Only pending payments can be cancelled" });
    await prisma.reservations.delete({ where: { id: parseInt(order_id) } });
    res.json({ success: true, message: "Payment cancelled." });
  } catch (error) {
    console.error("PAYMENT CANCEL ERROR:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/initiate-cart", authMiddleware, async (req, res) => {
  try {
    const { cart_items, order_type, delivery_lat, delivery_lng, delivery_address, delivery_fee } = req.body;
    const user_id = req.user.id;

    if (!cart_items || cart_items.length === 0) return res.status(400).json({ success: false, message: "Cart is empty" });

    let totalAmount = 0;
    const orderIds = [];
    let storeName = "SaveABite Store";
    const pickupCode = String(Math.floor(1000 + Math.random() * 9000));
    const fee = order_type === 'delivery' ? parseFloat(delivery_fee || 0) : 0;
    totalAmount += fee;

    for (const item of cart_items) {
      const listing = await prisma.listings.findUnique({
        where: { id: parseInt(item.listing_id) },
        include: { users: { select: { store_name: true } } },
      });

      if (!listing || listing.stock_quantity < item.quantity) throw new Error(`Item ${listing ? listing.item_name : item.listing_id} is out of stock`);
      if (listing.users?.store_name) storeName = listing.users.store_name;

      const itemPrice = parseFloat(listing.selling_price);
      totalAmount += itemPrice * item.quantity;

      for (let i = 0; i < item.quantity; i++) {
        const order = await prisma.reservations.create({
          data: {
            listing_id: parseInt(item.listing_id),
            user_id: user_id,
            status: "payment_pending",
            pickup_code: pickupCode,
            order_type: order_type || "pickup",
            delivery_lat: order_type === 'delivery' ? parseFloat(delivery_lat) : null,
            delivery_lng: order_type === 'delivery' ? parseFloat(delivery_lng) : null,
            delivery_address: order_type === 'delivery' ? delivery_address : null,
            delivery_fee: i === 0 ? fee : 0,
          },
        });
        orderIds.push(order.id);
      }
    }

    const amountInPaisa = Math.round(totalAmount * 100);
    const orderIdsStr = orderIds.join(",");
    const backendBase = process.env.KHALTI_RETURN_URL || `http://localhost:5000/api/payment/return`;
    const returnUrl = `${backendBase}?order_id=${orderIdsStr}`;

    const khaltiResponse = await axios.post(
      `${KHALTI_BASE}/initiate/`,
      {
        return_url: returnUrl,
        website_url: process.env.KHALTI_RETURN_URL ? process.env.KHALTI_RETURN_URL.replace(/\/api\/payment\/return$/, '') : "http://localhost:5000",
        amount: amountInPaisa,
        purchase_order_id: `CART-${orderIds[0]}`,
        purchase_order_name: `Cart Order from ${storeName}`,
        customer_info: { name: req.user.email, email: req.user.email },
      },
      { headers: { Authorization: `Key ${process.env.KHALTI_SECRET_KEY}`, "Content-Type": "application/json" } }
    );

    res.json({ success: true, order_id: orderIdsStr, pidx: khaltiResponse.data.pidx, payment_url: khaltiResponse.data.payment_url, amount: amountInPaisa });
  } catch (error) {
    console.error("CART INITIATE ERROR:", error.response?.data || error.message);
    res.status(500).json({ success: false, message: "Cart payment initiation failed", error: error.response?.data?.detail || error.message });
  }
});

router.post("/verify-cart", authMiddleware, async (req, res) => {
  try {
    const { pidx, order_id } = req.body;
    if (!pidx || !order_id) return res.status(400).json({ success: false, message: "pidx and order_id are required" });

    const verifyResponse = await axios.post(
      `${KHALTI_BASE}/lookup/`,
      { pidx },
      { headers: { Authorization: `Key ${process.env.KHALTI_SECRET_KEY}`, "Content-Type": "application/json" } }
    );

    const paymentData = verifyResponse.data;
    const orderIdArray = order_id.split(",").map(id => parseInt(id));

    if (paymentData.status === "Completed") {
      const result = await prisma.$transaction(async (tx) => {
        await tx.reservations.updateMany({ where: { id: { in: orderIdArray } }, data: { status: "confirmed" } });
        const orders = await tx.reservations.findMany({ where: { id: { in: orderIdArray } } });
        const listingCounts = {};
        for (const o of orders) listingCounts[o.listing_id] = (listingCounts[o.listing_id] || 0) + 1;
        for (const [lId, count] of Object.entries(listingCounts)) {
          await tx.listings.updateMany({ where: { id: parseInt(lId), stock_quantity: { gt: 0 } }, data: { stock_quantity: { decrement: count } } });
        }
        return orders[0];
      });

      // Notify user: order confirmed + payment received
      if (result?.user_id) {
        const amountNPR = Math.round((paymentData.total_amount || 0) / 100);
        const paidAt = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        await createNotification(prisma, result.user_id, "Order Confirmed", `Your order #${result.id} has been confirmed.`);
        await createNotification(prisma, result.user_id, "Payment Received", `NPR ${amountNPR} paid at ${paidAt}.`);
      }

      res.json({ success: true, message: "Payment verified! Cart order confirmed.", order: result, payment_status: paymentData.status });
    } else if (paymentData.status === "Pending") {
      res.json({ success: false, message: "Payment is still pending.", payment_status: paymentData.status });
    } else {
      await prisma.reservations.deleteMany({ where: { id: { in: orderIdArray } } });
      res.json({ success: false, message: "Payment failed or was cancelled.", payment_status: paymentData.status });
    }
  } catch (error) {
    console.error("CART VERIFY ERROR:", error.response?.data || error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/cancel-cart", authMiddleware, async (req, res) => {
  try {
    const { order_id } = req.body;
    const orderIdArray = order_id.split(",").map(id => parseInt(id));
    await prisma.reservations.deleteMany({ where: { id: { in: orderIdArray }, status: "payment_pending" } });
    res.json({ success: true, message: "Cart payment cancelled." });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 8. CASH ON DELIVERY — CART
 */
router.post("/cod-cart", authMiddleware, async (req, res) => {
  try {
    const { cart_items, order_type, delivery_lat, delivery_lng, delivery_address, delivery_fee } = req.body;
    const user_id = req.user.id;

    if (!cart_items || cart_items.length === 0) return res.status(400).json({ success: false, message: "Cart is empty" });

    const resolvedOrderType = order_type || "pickup";
    const parsedLat = parseFloat(delivery_lat);
    const parsedLng = parseFloat(delivery_lng);
    const safeDeliveryLat = isFinite(parsedLat) ? parsedLat : null;
    const safeDeliveryLng = isFinite(parsedLng) ? parsedLng : null;
    const fee = parseFloat(delivery_fee) || 0;
    const pickupCode = String(Math.floor(1000 + Math.random() * 9000));
    const orderIds = [];

    await prisma.$transaction(async (tx) => {
      for (const item of cart_items) {
        const listing = await tx.listings.findUnique({ where: { id: parseInt(item.listing_id) } });

        if (!listing || listing.stock_quantity < item.quantity) throw new Error(`Item ${listing ? listing.item_name : item.listing_id} is out of stock`);

        for (let i = 0; i < item.quantity; i++) {
          const order = await tx.reservations.create({
            data: {
              listings: { connect: { id: parseInt(item.listing_id) } },
              users: { connect: { id: user_id } },
              status: "confirmed",
              pickup_code: pickupCode,
              order_type: resolvedOrderType,
              delivery_lat: resolvedOrderType === "delivery" ? safeDeliveryLat : null,
              delivery_lng: resolvedOrderType === "delivery" ? safeDeliveryLng : null,
              delivery_address: resolvedOrderType === "delivery" ? (delivery_address || null) : null,
              delivery_fee: i === 0 ? fee : 0,
              payment_method: "cod",
            },
          });
          orderIds.push(order.id);
        }

        await tx.listings.updateMany({ where: { id: parseInt(item.listing_id), stock_quantity: { gt: 0 } }, data: { stock_quantity: { decrement: item.quantity } } });
      }
    });

    res.json({
      success: true,
      message: resolvedOrderType === "delivery" ? "Order placed! Pay cash to the driver on delivery." : "Order placed! Pay cash when you pick up at the store.",
      order_id: orderIds.join(","),
      pickup_code: pickupCode,
    });

    // Fire-and-forget notification — after response is sent
    createNotification(
      prisma, user_id,
      "Order Confirmed",
      `Your order #${orderIds[0]} has been confirmed. ${resolvedOrderType === "delivery" ? "Pay cash to the driver on delivery." : "Pay cash when you pick up at the store."}`
    );
  } catch (error) {
    console.error("COD CART ERROR:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
