import { getSession, setSession, clearSession } from "../utils/session.js";
import { sendText } from "../utils/sender.js";
import { MENUS } from "../utils/menus.js";
import { plans, getPlanById } from "../config/plans.js";
import { createOrder, getUserOrders, updateOrderStatus, getOrderByTxRef } from "../services/orders.js";
import { initializePayment, generateTxRef, verifyPaymentByRef } from "../services/payment.js";

/**
 * Core WhatsApp Conversation State Machine
 */
export async function handleMessage(sock, msg) {
  // Extract user identifiers and text
  const jid = msg.key.remoteJid;
  if (!jid) return;

  // We only reply to direct peer-to-peer messages (ignore groups / status alerts)
  if (jid.endsWith("@g.us") || jid === "status@broadcast") return;

  // Safely grab message text
  const rawText = (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.buttonsResponseMessage?.selectedButtonId ||
    ""
  ).trim();

  if (!rawText) return;

  const cleanText = rawText.toLowerCase();

  // Global commands bypassing any states
  if (["menu", "hi", "hello", "start", "restart", "cancel"].includes(cleanText)) {
    await clearSession(jid);
    await sendText(sock, jid, MENUS.MAIN_MENU);
    return;
  }

  // Fetch or construct existing session
  const session = await getSession(jid);
  const { state, data = {} } = session;

  try {
    switch (state) {
      case "MAIN_MENU": {
        switch (cleanText) {
          case "1":
            await setSession(jid, "SELECT_NETWORK", {});
            await sendText(sock, jid, MENUS.SELECT_NETWORK);
            break;

          case "2":
            await setSession(jid, "ASSIGNMENT_QUESTION", {});
            await sendText(sock, jid, MENUS.ASSIGNMENT_INTRO);
            break;

          case "3":
            await setSession(jid, "DOCUMENT_DETAILS", { step: 1 });
            await sendText(sock, jid, MENUS.DOCUMENT_INTRO);
            break;

          case "4": {
            await sendText(sock, jid, "⏳ *Retrieving your active order logs...*");
            const history = await getUserOrders(jid);
            if (history.length === 0) {
              await sendText(sock, jid, "📦 *My Orders*\n\nYou currently have no registered orders on record.\n\nType *1* to buy mobile data, or *2* / *3* to use our academic tutoring engines.");
            } else {
              let report = `📦 *YOUR RECENT ORDERS (Last 5)*\n━━━━━━━━━━━━━━━━━\n`;
              history.forEach((ord, index) => {
                const dateStr = ord.createdAt ? new Date(ord.createdAt).toLocaleDateString() : "N/A";
                report += `${index + 1}. *Type:* ${ord.type}\n`;
                if (ord.type === "DATA") {
                  report += `   *Details:* ${ord.network} - ${ord.planName} (${ord.phoneNumber})\n`;
                }
                report += `   *Ref:* ${ord.txRef}\n`;
                report += `   *Amount:* ₦${ord.amount}\n`;
                report += `   *Status:* ${ord.status === "paid" ? "✅ Paid / Dispatched" : "⏳ Pending Payment"}\n`;
                report += `   *Date:* ${dateStr}\n━━━━━━━━━━━━━━━━━\n`;
              });
              await sendText(sock, jid, report);
            }
            // Return back to main menu
            await clearSession(jid);
            await sendText(sock, jid, MENUS.MAIN_MENU);
            break;
          }

          case "5":
            await setSession(jid, "CHECK_PAYMENT", {});
            await sendText(sock, jid, MENUS.CHECK_PAYMENT_INTRO);
            break;

          case "0":
            await sendText(sock, jid, MENUS.ABOUT);
            break;

          default:
            await sendText(
              sock,
              jid,
              `❌ *Invalid input.*\n\nPlease type a matching option number *0* to *5* to choose a service from the menu.\n\n${MENUS.MAIN_MENU}`
            );
        }
        break;
      }

      case "SELECT_NETWORK": {
        const option = cleanText;
        let network = "";
        
        if (option === "1") network = "MTN";
        else if (option === "2") network = "Airtel";
        else if (option === "3") network = "Glo";
        else if (option === "4") network = "9mobile";
        else if (option === "99") {
          await clearSession(jid);
          await sendText(sock, jid, MENUS.MAIN_MENU);
          return;
        }

        if (network) {
          const netPlans = plans[network];
          let planText = `📡 *SELECT ${network.toUpperCase()} PLAN*\n━━━━━━━━━━━━━━━━━\n`;
          netPlans.forEach((p, idx) => {
            planText += `${idx + 1}. *${p.name}* — ₦${p.amount}\n`;
          });
          planText += `\n99. 🔙 Change Network\n━━━━━━━━━━━━━━━━━\nReply with a number (1-6).`;

          await setSession(jid, "SELECT_PLAN", { network });
          await sendText(sock, jid, planText);
        } else {
          await sendText(sock, jid, `❌ *Invalid Network Code.*\n\n${MENUS.SELECT_NETWORK}`);
        }
        break;
      }

      case "SELECT_PLAN": {
        const option = cleanText;
        const { network } = data;

        if (option === "99") {
          await setSession(jid, "SELECT_NETWORK", {});
          await sendText(sock, jid, MENUS.SELECT_NETWORK);
          return;
        }

        const planIndex = parseInt(option) - 1;
        const netPlans = plans[network];

        if (planIndex >= 0 && planIndex < netPlans.length) {
          const selectedPlan = netPlans[planIndex];
          
          await setSession(jid, "ENTER_PHONE", {
            network,
            planId: selectedPlan.id,
            planName: selectedPlan.name,
            amount: selectedPlan.amount
          });

          await sendText(
            sock,
            jid,
            `📱 *RECIPIENT PHONE NUMBER*\n━━━━━━━━━━━━━━━━━\nPlease type the target *Phone Number* to receive this data description (e.g., 08031234567):`
          );
        } else {
          await sendText(sock, jid, "❌ *Option out of bounds.*\n\nPlease reply with a plan option number from *1* to *6*, or *99* to change network.");
        }
        break;
      }

      case "ENTER_PHONE": {
        const phoneInput = rawText.replace(/\s+/g, "");
        // Clean regex verification for Nigerian numbers
        const cleanReg = /^(0|234|\+234)?(70|80|81|90|91|71|82|72)\d{8}$/;

        if (cleanReg.test(phoneInput)) {
          // Normalize to standard Nigerian local prefix
          let targetMobile = phoneInput;
          if (targetMobile.startsWith("+")) targetMobile = targetMobile.slice(1);
          if (targetMobile.startsWith("234")) targetMobile = "0" + targetMobile.slice(3);

          const orderDetails = {
            ...data,
            phoneNumber: targetMobile
          };

          await setSession(jid, "CONFIRM_DATA_ORDER", orderDetails);

          const summary = `🛒 *DATA ORDER REVIEW*
━━━━━━━━━━━━━━━━━
📡 Carrier: *${orderDetails.network}*
📦 Plan: *${orderDetails.planName}*
💰 Amount: *₦${orderDetails.amount}*
📱 Beneficiary: *${orderDetails.phoneNumber}*
━━━━━━━━━━━━━━━━━
Is this correct?

1. ✅ Confirm and Generate Invoice
2. ❌ Discard & Main Menu`;

          await sendText(sock, jid, summary);
        } else {
          await sendText(
            sock,
            jid,
            "❌ *Invalid Mobile Number.*\n\nPlease enter a valid Nigerian mobile phone number (11 digits, e.g. *08031234567*):"
          );
        }
        break;
      }

      case "CONFIRM_DATA_ORDER": {
        if (cleanText === "1") {
          await sendText(sock, jid, "⏳ *Connecting to payment processor...*");

          const txRef = generateTxRef();
          const paymentResult = await initializePayment({
            amount: data.amount,
            txRef,
            phone: jid,
            description: `${data.network} Data Subscription [${data.planName}] to ${data.phoneNumber}`
          });

          if (paymentResult.success) {
            // Write pending order
            await createOrder({
              phone: jid,
              type: "DATA",
              planId: data.planId,
              planName: data.planName,
              network: data.network,
              amount: data.amount,
              phoneNumber: data.phoneNumber,
              txRef,
              status: "pending"
            });

            await sendText(
              sock,
              jid,
              `💳 *INVOICE GENERATED*
━━━━━━━━━━━━━━━━━
Plan: *${data.network} - ${data.planName}*
To: *${data.phoneNumber}*
Charge: *₦${data.amount}*

🔗 *TAP HERE TO PAY:*
${paymentResult.link}

ID Code: *${txRef}*
━━━━━━━━━━━━━━━━━
_Your top-up will load automatically immediately after payment confirms. Type "menu" if you need to exit._`
            );
          } else {
            await sendText(
              sock,
              jid,
              `⚠️ *Payment gateway error:* ${paymentResult.error || "Please try again later."}`
            );
          }
          await clearSession(jid);
        } else {
          await clearSession(jid);
          await sendText(sock, jid, MENUS.MAIN_MENU);
        }
        break;
      }

      case "ASSIGNMENT_QUESTION": {
        const questionText = rawText;
        if (questionText.length < 10) {
          await sendText(sock, jid, "⚠️ Your question is too short. Please provide details so the AI can build a high-grade answer.");
          return;
        }

        await setSession(jid, "CONFIRM_ASSIGNMENT", {
          question: questionText,
          amount: 500
        });

        const confirmMsg = `📝 *CONFIRM ASSIGNMENT PROMPT*
━━━━━━━━━━━━━━━━━
Question Selected:
_"${questionText.substring(0, 150)}${questionText.length > 150 ? '...' : ''}"_

Tutor Fee: *₦500*
━━━━━━━━━━━━━━━━━
1. ✅ Confirm and Generate Invoice
2. ❌ Discard & Main Menu`;

        await sendText(sock, jid, confirmMsg);
        break;
      }

      case "CONFIRM_ASSIGNMENT": {
        if (cleanText === "1") {
          await sendText(sock, jid, "⏳ *Generating assignment billing invoice...*");

          const txRef = generateTxRef();
          const paymentResult = await initializePayment({
            amount: 500,
            txRef,
            phone: jid,
            description: "BotVault Assignment AI solver fee (₦500)"
          });

          if (paymentResult.success) {
            await createOrder({
              phone: jid,
              type: "ASSIGNMENT",
              amount: 500,
              txRef,
              status: "pending",
              details: {
                question: data.question
              }
            });

            await sendText(
              sock,
              jid,
              `💳 *INVOICE GENERATED*
━━━━━━━━━━━━━━━━━
Service: *AI Assignment Solution*
Charge: *₦500*

🔗 *TAP HERE TO PAY:*
${paymentResult.link}

ID Ref: *${txRef}*
━━━━━━━━━━━━━━━━━
_Once paid, the bot will generate and deliver a comprehensive tutoring response here instantly._`
            );
          } else {
            await sendText(sock, jid, `⚠️ *Gateway loading failed:* ${paymentResult.error}`);
          }
          await clearSession(jid);
        } else {
          await clearSession(jid);
          await sendText(sock, jid, MENUS.MAIN_MENU);
        }
        break;
      }

      case "DOCUMENT_DETAILS": {
        const step = data.step || 1;

        if (step === 1) {
          // Saving Document Title
          const docTitle = rawText;
          await setSession(jid, "DOCUMENT_DETAILS", {
            ...data,
            title: docTitle,
            step: 2
          });
          await sendText(sock, jid, "🎯 *Step 2 of 4: Research Topic*\n━━━━━━━━━━━━━━━━━\nPlease write a detailed explanation of the *Topic* or specific focus area of the study:");
        } 
        else if (step === 2) {
          // Saving Topic
          const docTopic = rawText;
          await setSession(jid, "DOCUMENT_DETAILS", {
            ...data,
            topic: docTopic,
            step: 3
          });
          await sendText(
            sock,
            jid,
            `📂 *Step 3 of 4: Document Type*
━━━━━━━━━━━━━━━━━
What format of academic output should be formatted?

1. Assignment Paper
2. Essay Study File
3. Professional Report
4. Term Project File

Reply with a number (1-4).`
          );
        } 
        else if (step === 3) {
          // Saving Document Type
          let docType = "";
          if (cleanText === "1") docType = "Assignment";
          else if (cleanText === "2") docType = "Essay";
          else if (cleanText === "3") docType = "Professional Report";
          else if (cleanText === "4") docType = "Term Project";

          if (docType) {
            await setSession(jid, "DOCUMENT_DETAILS", {
              ...data,
              type: docType,
              step: 4
            });
            await sendText(sock, jid, "✍️ *Step 4 of 4: Author's Name*\n━━━━━━━━━━━━━━━━━\nPlease provide the *student/author's name* (e.g. John Doe) to paint on the title page:");
          } else {
            await sendText(sock, jid, "❌ *Selection range out of bounds. Reply with a number from 1 to 4:*");
          }
        } 
        else if (step === 4) {
          // Saving Author
          const author = rawText;
          const reviewData = {
            title: data.title,
            topic: data.topic,
            type: data.type,
            author: author,
            amount: 1000
          };

          await setSession(jid, "CONFIRM_DOCUMENT", reviewData);

          const docSummary = `📄 *REVIEW RESEARCH DOCUMENT REQUEST*
━━━━━━━━━━━━━━━━━
📂 Form: *${reviewData.type}*
🏷️ Title: *${reviewData.title}*
🎯 Topic: *${reviewData.topic}*
✍️ Author: *${reviewData.author}*
💰 Settlement: *₦1,000*
━━━━━━━━━━━━━━━━━
Is this accurate?

1. ✅ Confirm and Generate Invoice
2. ❌ Discard & Main Menu`;

          await sendText(sock, jid, docSummary);
        }
        break;
      }

      case "CONFIRM_DOCUMENT": {
        if (cleanText === "1") {
          await sendText(sock, jid, "⏳ *Generating draft document invoice on portal...*");

          const txRef = generateTxRef();
          const paymentResult = await initializePayment({
            amount: 1000,
            txRef,
            phone: jid,
            description: `BotVault Doc writing: "${data.title}" by ${data.author}`
          });

          if (paymentResult.success) {
            await createOrder({
              phone: jid,
              type: "DOCUMENT",
              amount: 1000,
              txRef,
              status: "pending",
              details: {
                title: data.title,
                topic: data.topic,
                type: data.type,
                author: data.author
              }
            });

            await sendText(
              sock,
              jid,
              `💳 *INVOICE GENERATED*
━━━━━━━━━━━━━━━━━
Paper: *"${data.title}"*
Writer: *${data.author}*
Format: *Double-spaced .docx*
Cost: *₦1,000*

🔗 *TAP HERE TO PAY:*
${paymentResult.link}

Reference: *${txRef}*
━━━━━━━━━━━━━━━━━
_As soon as settlement confirms, Gemini writes the draft (800-1200 words), parses it into APA layout, and delivers the file._`
            );
          } else {
            await sendText(sock, jid, `⚠️ *Gateway initializing failed:* ${paymentResult.error}`);
          }
          await clearSession(jid);
        } else {
          await clearSession(jid);
          await sendText(sock, jid, MENUS.MAIN_MENU);
        }
        break;
      }

      case "CHECK_PAYMENT": {
        const inputRef = rawText.toUpperCase().trim();
        await sendText(sock, jid, `⏳ *Verifying reference code [${inputRef}]...*`);

        const order = await getOrderByTxRef(inputRef);
        if (!order) {
          await sendText(sock, jid, `❌ *Order Not Found.*\n\nThe payment reference *${inputRef}* does not exist. Please double-check your spelling.`);
          await clearSession(jid);
          await sendText(sock, jid, MENUS.MAIN_MENU);
          return;
        }

        if (order.status === "paid") {
          await sendText(
            sock,
            jid,
            `✅ *Payment Confirmed!*
━━━━━━━━━━━━━━━━━
Order Status: *PAID / COMPLETED*
Type: *${order.type}*
Ref ID: *${order.txRef}*

If the content was not delivered, please expect fulfillment within the next 20 seconds.`
          );
          await clearSession(jid);
          await sendText(sock, jid, MENUS.MAIN_MENU);
          return;
        }

        // Pull reference status from Flutterwave
        const lStatus = await verifyPaymentByRef(inputRef);
        if (lStatus.success) {
          await sendText(sock, jid, `🎉 *New Payment Registered via Flutterwave!*`);
          await updateOrderStatus(inputRef, "paid");
          // Fulfill immediately on background poll check
        } else {
          await sendText(
            sock,
            jid,
            `⏳ *Sovereign status shows pending.*

The invoice *${inputRef}* has not been finalized yet.

If you have already paid, please verify your bank debit, or try verifying again in 1 minute.
(Error: ${lStatus.error || "Gateway Unnotified"})`
          );
        }

        await clearSession(jid);
        await sendText(sock, jid, MENUS.MAIN_MENU);
        break;
      }

      default: {
        await clearSession(jid);
        await sendText(sock, jid, MENUS.MAIN_MENU);
      }
    }
  } catch (err) {
    console.error(`Error processing state machine for user ${jid}:`, err);
    await sendText(sock, jid, "⚠️ *Internal Bot Error.*\nSorry, an error occurred processing your input. We've returned you to the Main Menu.");
    await clearSession(jid);
    await sendText(sock, jid, MENUS.MAIN_MENU);
  }
}
