import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { updateOrderStatus, db } from "./src/config/firebase.js"; // Import db from firebase

// Express app initializer
export const app = express();

// Enable standard JSON parsing
app.use(express.json());

// Set mock initial global bot status
global.botStatus = {
  connected: false,
  qr: null,
  error: null
};

/**
 * 1. GET /api/status - Returns WhatsApp connection status
 */
app.get("/api/status", (req, res) => {
  res.json({
    connected: global.botStatus.connected,
    qr: global.botStatus.qr,
    error: global.botStatus.error,
    adminPhone: process.env.ADMIN_PHONE || "2348000000000"
  });
});

/**
 * 2. GET /api/orders - Fetches recent 10 transactions from Firestore for dashboard view
 */
app.get("/api/orders", async (req, res) => {
  try {
    const snapshot = await db.collection("orders")
      .orderBy("createdAt", "desc")
      .limit(10)
      .get();
    
    const list = [];
    snapshot.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() });
    });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 3. POST /api/test-webhook - Testing diagnostic endpoint to simulate payment webhook locally
 */
app.post("/api/test-webhook", async (req, res) => {
  const { txRef } = req.body;
  if (!txRef) {
    return res.status(400).json({ error: "Missing target 'txRef' property in payload body." });
  }

  try {
    const updated = await db.collection("orders").where("txRef", "==", txRef).limit(1).get();
    if (updated.empty) {
      return res.status(404).json({ error: `No registered order matches txRef: ${txRef}` });
    }

    const orderDoc = updated.docs[0];
    const orderRef = orderDoc.data().txRef;

    // Trigger standard fulfillment update pipeline
    const ordersModule = await import("./src/services/orders.js");
    const success = await ordersModule.updateOrderStatus(orderRef, "paid");
    
    if (success) {
      res.json({ success: true, message: `Successfully simulated Flutterwave payout for: ${orderRef}` });
    } else {
      res.status(400).json({ error: "Order status change rejected (is it already paid?)" });
    }
  } catch (err) {
    console.error("Test Webhook mock error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 4. POST /webhook/flutterwave - Standard payout callback webhook
 */
app.post("/webhook/flutterwave", async (req, res) => {
  const clientHash = req.headers["verif-hash"] || req.headers["flw-secret-hash"];
  const secretHash = process.env.FLW_SECRET_HASH;

  console.log("Incoming Flutterwave Webhook triggered:", req.body);

  // Secure webhook authentication
  if (secretHash) {
    if (clientHash !== secretHash) {
      console.warn("[WEBHOOK SECRET MISMATCH] Refusing unauthorized payout attempt.");
      return res.status(401).json({ status: "error", message: "Unauthorized FLW signatures match failure." });
    }
  } else {
    console.warn("FLW_SECRET_HASH is undefined in surroundings. Dev mode bypass unlocked.");
  }

  const payload = req.body;
  const event = payload.event;
  const data = payload.data || payload;

  const txRef = data.tx_ref || data.tx_Ref || data.txRef;
  const status = data.status;

  if (txRef && (status === "successful" || status === "success" || event?.includes("completed"))) {
    console.log(`Payment verify succeeded via webhook for Reference: ${txRef}`);
    try {
      const ordersModule = await import("./src/services/orders.js");
      const complete = await ordersModule.updateOrderStatus(txRef, "paid");
      if (complete) {
        return res.json({ status: "success", message: "Order processed and queued to fulfill." });
      }
    } catch (err) {
      console.error(`Error updating payment logs via Webhook:`, err);
      return res.status(500).json({ status: "error", message: err.message });
    }
  }

  // Always return standard 200 OK to acknowledge receiving from Flutterwave
  res.json({ status: "acknowledged" });
});

/**
 * Bootstrapping complete Full-Stack Express and router pipeline
 */
export async function initializeServer() {
  const PORT = process.env.PORT || 3000;
  
  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Express mounted: Production distribution bundles active.");
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
    console.log("Express mounted: Vite HMR developer proxy server loaded.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express web server now active on http://0.0.0.0:${PORT}`);
  });
}
