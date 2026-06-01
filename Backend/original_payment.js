const express = require("express");
const router = express.Router();
const axios = require("axios");
const prisma = require("../lib/prisma");
const { authMiddleware } = require("../middleware/authMiddleware");

// Khalti API base — using SANDBOX/TEST endpoint (not production)
// Production: https://a.khalti.com/api/v2/epayment
// Sandbox:    https://dev.khalti.com/api/v2/epayment
const KHALTI_BASE = "https://dev.khalti.com/api/v2/epayment";

/**
 * 1. INITIATE PAYMENT
 * Called by the mobile app before opening Khalti checkout.
 * Creates an order (reservation) in "payment_pending" status,
 * then calls Khalti to get a payment_url.
 */
router.post("/initiate", authMiddleware, async (req, res) => {
  try {
    const { listing_id } = req.body;
    const user_id = req.user.id;

    // Fetch the listing to get the price
    const listing = await prisma.listings.findUnique({
      where: { id: parseInt(listing_id) },
      include: {
        users: { select: { store_name: true } },
      },
    });

    if (!listing) {
      return res.status(404).json({ success: false, message: "Listing not found" });
    }

    if (listing.stock_quantity <= 0) {
      return res.status(400).json({ success: false, message: "Out of stock!" });
    }

    const amountInPaisa = Math.round(parseFloat(listing.selling_price) * 100);
    const itemName = listing.item_name || "Surprise Bag";
    const storeName = listing.users?.store_name || "SaveABite Store";

    // Create a pending order first
    const order = await prisma.reservations.create({
      data: {
        listing_id: parseInt(listing_id),
        user_id: user_id,
        status: "payment_pending",
        pickup_code: String(Math.floor(1000 + Math.random() * 9000)),
      },
    });

    // Build the return URL — points to our backend redirect page
    // The backend will then deep-link the user back into the app
    const backendBase = process.env.KHALTI_RETURN_URL || `http://localhost:5000/api/payment/return`;
    const returnUrl = `${backendBase}?order_id=${order.id}`;

    // Call Khalti Initiate API
    const khaltiResponse = await axios.post(
      `${KHALTI_BASE}/initiate/`,
      {
        return_url: returnUrl,
        website_url: process.env.KHALTI_RETURN_URL ? process.env.KHALTI_RETURN_URL.replace(/\/api\/payment\/return$/, '') : "http://localhost:5000",
        amount: amountInPaisa,
        purchase_order_id: `ORDER-${order.id}`,
        purchase_order_name: `${itemName} from ${storeName}`,
        customer_info: {
          name: req.user.email,
          email: req.user.email,
        },
      },
      {
        headers: {
          Authorization: `Key ${process.env.KHALTI_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const { pidx, payment_url } = khaltiResponse.data;

    // Store pidx on the order for later verification
    await prisma.reservations.update({
      where: { id: order.id },
      data: {
        status: "payment_pending",
      },
    });

    res.json({
      success: true,
      order_id: order.id,
      pidx: pidx,
      payment_url: payment_url,
      amount: amountInPaisa,
    });
  } catch (error) {
    console.error("KHALTI INITIATE ERROR:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Payment initiation failed",
      error: error.response?.data?.detail || error.message,
    });
  }
});

/**
 * 2. PAYMENT RETURN PAGE (GET)
 * Khalti redirects the user here after payment.
 * This serves an HTML page that deep-links back into the SaveABite app.
 * Khalti appends ?pidx=...&transaction_id=...&amount=...&purchase_order_id=... to the URL.
 */
router.get("/return", async (req, res) => {
  const { pidx, order_id, transaction_id, amount, purchase_order_id } = req.query;

  // Build the deep link URL for the app
  const deepLink = `saveabite-app://payment/verify?pidx=${pidx || ""}&order_id=${order_id || ""}`;

  // Serve a simple HTML page that redirects to the app
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Returning to SaveABite...</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #244F42 0%, #1a3a30 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }
        .container {
          text-align: center;
          padding: 40px 30px;
          max-width: 400px;
        }
        .checkmark {
          width: 80px;
          height: 80px;
          background: rgba(255,255,255,0.15);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px;
          font-size: 40px;
        }
        h1 {
          font-size: 24px;
          margin-bottom: 12px;
          font-weight: 700;
        }
        p {
          font-size: 16px;
          opacity: 0.85;
          margin-bottom: 30px;
          line-height: 1.5;
        }
        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(255,255,255,0.2);
          border-top-color: #F4A71D;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto 24px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .btn {
          display: inline-block;
          background: #F4A71D;
          color: #244F42;
          padding: 14px 32px;
          border-radius: 12px;
          text-decoration: none;
          font-weight: 700;
          font-size: 16px;
        }
        .btn:active { opacity: 0.8; }
        .note {
          margin-top: 20px;
          font-size: 13px;
          opacity: 0.6;
        }
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

      <script>
        // Attempt to deep-link back to the app after a short delay
        setTimeout(function() {
          window.location.href = "${deepLink}";
        }, 1500);
      </script>
    </body>
    </html>
  `);
});

/**
 * 3. VERIFY PAYMENT
 * Called after user returns from Khalti checkout.
 * Verifies the payment with Khalti API and confirms the order.
 */
router.post("/verify", authMiddleware, async (req, res) => {
  try {
    const { pidx, order_id } = req.body;

    if (!pidx || !order_id) {
      return res.status(400).json({
        success: false,
        message: "pidx and order_id are required",
      });
    }

    // Verify with Khalti
    const verifyResponse = await axios.post(
      `${KHALTI_BASE}/lookup/`,
      { pidx },
      {
        headers: {
          Authorization: `Key ${process.env.KHALTI_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const paymentData = verifyResponse.data;
    console.log("Khalti Verification Response:", paymentData);

    if (paymentData.status === "Completed") {
      // Payment successful — confirm the order and decrease stock
      const result = await prisma.$transaction(async (tx) => {
        const order = await tx.reservations.findUnique({
          where: { id: parseInt(order_id) },
        });

        if (!order) throw new Error("ORDER_NOT_FOUND");

        // Update order to confirmed
        const updatedOrder = await tx.reservations.update({
          where: { id: parseInt(order_id) },
          data: { status: "confirmed" },
        });

        // Decrease stock
        await tx.listings.update({
          where: { id: order.listing_id },
          data: { stock_quantity: { decrement: 1 } },
        });

        return updatedOrder;
      });

      res.json({
        success: true,
        message: "Payment verified! Your order is confirmed.",
        order: result,
        payment: {
          status: paymentData.status,
          amount: paymentData.total_amount,
          transaction_id: paymentData.transaction_id,
        },
      });
    } else if (paymentData.status === "Pending") {
      res.json({
        success: false,
        message: "Payment is still pending. Please complete the payment.",
        payment_status: paymentData.status,
      });
    } else {
      // Payment failed — clean up the pending order
      await prisma.reservations.delete({
        where: { id: parseInt(order_id) },
      });

      res.json({
        success: false,
        message: "Payment failed or was cancelled.",
        payment_status: paymentData.status,
      });
    }
  } catch (error) {
    console.error("KHALTI VERIFY ERROR:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Payment verification failed",
      error: error.response?.data?.detail || error.message,
    });
  }
});

/**
 * 4. CANCEL PENDING PAYMENT
 * If user cancels before completing Khalti checkout
 */
router.post("/cancel", authMiddleware, async (req, res) => {
  try {
    const { order_id } = req.body;

    const order = await prisma.reservations.findUnique({
      where: { id: parseInt(order_id) },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.status !== "payment_pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending payments can be cancelled",
      });
    }

    await prisma.reservations.delete({
      where: { id: parseInt(order_id) },
    });

    res.json({ success: true, message: "Payment cancelled." });
  } catch (error) {
    console.error("PAYMENT CANCEL ERROR:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
