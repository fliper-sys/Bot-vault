import makeWASocket, { useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import { initializeServer } from "./webhook.js";
import { handleMessage } from "./src/handlers/messageHandler.js";
import { pollAndFulfill } from "./src/services/fulfillment.js";

/**
 * Main Application orchestrator
 * Initializes both Express Server and Baileys WhatsApp bot
 */

let sockInstance = null;

async function startWhatsAppBot() {
  console.log("Initializing BotVault Baileys WhatsApp connection state...");
  
  // Use robust, persistent multi-file local authentication state
  const { state, saveCreds } = await useMultiFileAuthState("./auth_info_baileys");

  const sock = makeWASocket.default({
    auth: state,
    printQRInTerminal: false, // Disabling default to control manually with logger styling
    logger: undefined, // Silencing default pino trace spam to keep container logs spotless
  });

  sockInstance = sock;

  // Handle Baileys connection state lifecycle
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n💬 [BOTVAULT CONNECTION REQUIRED]");
      console.log("Please scan this QR code with WhatsApp Link Device:\n");
      
      // Render clean terminal QR
      qrcode.generate(qr, { small: true });
      
      // Assign global state variables to power web front-end displays
      global.botStatus.qr = qr;
      global.botStatus.connected = false;
      global.botStatus.error = null;
    }

    if (connection === "connecting") {
      console.log("⚡ Connecting to WhatsApp servers...");
      global.botStatus.connected = false;
    }

    if (connection === "open") {
      console.log("✅ BotVault is ONLINE and connected to WhatsApp successfully!");
      global.botStatus.connected = true;
      global.botStatus.qr = null;
      global.botStatus.error = null;

      // START FULFILLMENT POLLER LOOPS every 20 seconds on open
      console.log("⏱️ Initializing 20s Automated Service Fulfillment dispatcher...");
      setInterval(() => {
        pollAndFulfill(sockInstance).catch((err) => {
          console.error("Fulfillment Poller Intercepted Unhandled Error:", err.message);
        });
      }, 20000);
    }

    if (connection === "close") {
      global.botStatus.connected = false;
      global.botStatus.qr = null;

      const statusCode = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      
      console.warn(`❌ Connection closed. Reason ID: [${statusCode}]. Reconnecting: ${shouldReconnect}`);
      global.botStatus.error = lastDisconnect?.error?.message || "Connection Closed";

      if (shouldReconnect) {
        // Attempt immediate connection recursion
        setTimeout(() => startWhatsAppBot(), 5000);
      } else {
        console.error("🔒 Bot is logged out from device. Authenticated credentials deleted. Reconnect manually.");
      }
    }
  });

  // Track credentials sync to save files
  sock.ev.on("creds.update", saveCreds);

  // Bind message event responder
  sock.ev.on("messages.upsert", async (m) => {
    try {
      if (m.type !== "notify") return;
      
      for (const rawMsg of m.messages) {
        if (rawMsg.key.fromMe) continue; // Skip messages sent by the bot JID
        
        await handleMessage(sock, rawMsg);
      }
    } catch (err) {
      console.error("Panic in messages.upsert trigger scope:", err);
    }
  });
}

// 🚀 STARTUP ENGINES
async function main() {
  try {
    // 1. Fire Webhook, API endpoints and serving portals
    await initializeServer();
    
    // 2. Fire Bot Services
    await startWhatsAppBot();
  } catch (err) {
    console.error("Fatal bootstrapping startup interruption:", err);
    process.exit(1);
  }
}

main();
