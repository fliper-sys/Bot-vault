# BotVault 🤖 (WhatsApp Automation Bot by LBtech)

**BotVault** is a production-ready, fully-automated WhatsApp business bot designed to stream high-speed mobile data subscription sales, solve homework questions with deep academic explanations via Gemini 1.5 Flash, and compile comprehensive Word documents (`.docx`) in APA citation format. 

Built for **LBtech** (https://lbtech.site).

---

## 🚀 Key Features

1. **📡 Automated Data Subscription Sales**
   - Instant telecom simulations with plan offerings for MTN, Airtel, Glo, and 9mobile.
   - Integrates secure checkout link generation using the Flutterwave v3 payments API.
   
2. **📝 AI Assignment Solver**
   - Students submit their homework questions.
   - Charges a custom tutor billing rate of ₦500.
   - Leverages Google Gemini 1.5 Flash to write rich, step-by-step academic solutions delivered directly via WhatsApp messaging.

3. **📄 Document Writing Suite (.docx)**
   - Walkthrough conversational flow for drafting: Essays, Technical Reports, Project plans, and Homework terms.
   - Charges ₦1,000.
   - Gemini automatically compiles 800-1200 words of research.
   - Packages the manuscript into standard Word .docx format featuring Times New Roman font, double line spacing (1.5), and APA reference indexes, then delivers the formatted file over WhatsApp.

4. **⚡ High-Trust Redundancies**
   - Active transactional ledger and real-time session tracking powered by Google Cloud Firestore.
   - Manual payment status checking tool so users can verify transactions instantly using transaction references.
   - Built-in sandbox payments bypassed tester allowing you to verify document and data deliveries immediately without real credit card charges.

---

## 🛠️ Environment Variables Configuration

Set up these environment variables in your active `.env` file before executing BotVault:

```env
# Flutterwave secret token key
FLW_SECRET_KEY="FLW_SEC_KEY..."
FLW_SECRET_HASH="custom_hash_key..."
FLW_REDIRECT_URL="https://ais-pre-7f6wpyrixapuw77bbkcofw-969358704275.europe-west2.run.app/payment-success"

# Google Gemini secret token key
GEMINI_API_KEY="AIzaSy..."

# Firebase Admin projectId (auto-config file loads if available)
FIREBASE_PROJECT_ID="aerobic-limiter-jtsmh"

# Port
PORT=3000

# WhatsApp business operator phone number
ADMIN_PHONE="2348000000000"
```

---

## 📦 Developer Sandbox Run-through

Checking service deliveries is incredibly easy and does not require active bank configurations:

1. Launch BotVault on dev server:
   ```bash
   npm run build && npm run dev
   ```
2. Scan the displayed terminal QR code (or use the web dashboard at port `3000` to find the QR code) with your mobile phone via **WhatsApp > Linked Devices**.
3. Send `"hi"` to the bot to activate the menu block.
4. Complete an order (e.g., select MTN package, write your destination phone number) and copy the generated reference invoice code (begins with `BV-`).
5. Open the web portal, paste your reference code inside the **Developer Sandbox and Trigger Panel**, and click **Simulate Payout**.
6. The background fulfillment dispatcher will immediately catch the transaction on the next loop (20 seconds), fetch your data, connect Gemini, generate the Word document, and dispatch the file directly to your WhatsApp screen!
