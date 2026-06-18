import { db } from "../config/firebase.js";
import { solveAssignment, generateDocument, buildDocxFromData } from "./ai.js";
import { sendText, sendDocument } from "../utils/sender.js";

/**
 * Background Fulfillment Task Processor
 * Delivers services to users automatically on payments
 */

let isProcessing = false;

export async function pollAndFulfill(sock) {
  if (isProcessing) return;
  
  if (!sock) {
    console.warn("Fulfillment poller cannot run. Baileys socket is inactive.");
    return;
  }

  isProcessing = true;

  try {
    const query = await db.collection("fulfillments")
      .where("status", "==", "pending")
      .limit(3) // Process up to 3 at a time safely
      .get();

    if (query.empty) {
      isProcessing = false;
      return;
    }

    console.log(`Fulfillment loop triggered. Processing ${query.size} pending tasks...`);

    for (const doc of query.docs) {
      const fulfillmentId = doc.id;
      const task = doc.data();
      const recipient = task.recipient; // WhatsApp JID
      const txRef = task.txRef;

      // Update immediate task status to in-progress to lock it from double execution
      await doc.ref.update({ status: "processing", processedAt: new Date().toISOString() });

      try {
        if (task.type === "DATA") {
          // 1. DATA SUBSCRIPTION DISPATCH
          const { network, planName, phoneNumber } = task.data;
          
          await sendText(sock, recipient, `⌛ *Dispatched [${network} - ${planName}] data bundle to ${phoneNumber} in our telecom switch...*`);
          
          // Easing artificial switch connection of 2 seconds
          await new Promise(r => setTimeout(r, 2500));

          const completionMsg = `📡 *DATA TOPUP COMPLETED*
━━━━━━━━━━━━━━━━━
Receipt: *${txRef}*
Carrier: *${network}*
Bundle: *${planName}*
Target: *${phoneNumber}*
Status: *SUCCESS (ACTIVE)*
━━━━━━━━━━━━━━━━━
Your high-speed data balance was fully credited. Thank you for using BotVault by LBtech!`;

          await sendText(sock, recipient, completionMsg);
          await doc.ref.update({ status: "completed", finishedAt: new Date().toISOString() });
          console.log(`Fulfillment [DATA] completed successfully for ${recipient}`);
        } 
        else if (task.type === "ASSIGNMENT") {
          // 2. AI ASSIGNMENT SOLVER
          const { question } = task.data.details || {};
          
          await sendText(sock, recipient, `🧠 *Analyzing your academic question. Charging Gemini tutors...*`);

          if (!question) {
            throw new Error("Missing assignment question in details.");
          }

          const responseText = await solveAssignment(question);

          const fullReply = `📝 *ASSIGNMENT SOLUTION (AI)*
━━━━━━━━━━━━━━━━━
Invoice ID: *${txRef}*
━━━━━━━━━━━━━━━━━

${responseText}

━━━━━━━━━━━━━━━━━
_Solved with academic excellence using Gemini 1.5 Flash._`;

          await sendText(sock, recipient, fullReply);
          await doc.ref.update({ status: "completed", finishedAt: new Date().toISOString() });
          console.log(`Fulfillment [ASSIGNMENT] completed successfully for ${recipient}`);
        } 
        else if (task.type === "DOCUMENT") {
          // 3. DOCUMENT GENERATOR (.DOCX)
          const { title, topic, type: docType, author } = task.data.details || {};

          await sendText(sock, recipient, `📄 *Drafting research document paper: "${title}"*...\n\n_Generating 800-1200 words academic text using Gemini tutors..._`);

          if (!title || !topic) {
            throw new Error("Missing document configuration details (title/topic).");
          }

          // Call Gemini
          const docData = await generateDocument({
            title,
            topic,
            type: docType,
            author
          });

          await sendText(sock, recipient, `🖨️ *Compiling Word Manuscript (Times New Roman, Size 12, APA style references)...*`);

          // Compile document bytes using build buffer docx API
          const wordBuffer = await buildDocxFromData({
            title: docData.title || title,
            subtitle: docData.subtitle || "",
            institution: docData.institution || "Department of General Academic Studies, LBtech Academy",
            introduction: docData.introduction,
            sections: docData.sections,
            conclusion: docData.conclusion,
            references: docData.references,
            author: author
          });

          // Deliver custom manuscript file
          const fileName = `LBtech_${author.replace(/[^a-z0-9]/gi, "_")}_Paper.docx`;
          const caption = `📄 *YOUR ACADEMIC DOCUMENT IS READY!*
━━━━━━━━━━━━━━━━━
Invoice ID: *${txRef}*
Title: *"${docData.title}"*
Type: *${docType}*
Standard: *APA 7th Format (Double Spaced)*

Thank you for choosing BotVault by LBtech. Your document is attached below:`;

          await sendDocument(sock, recipient, wordBuffer, fileName, caption);
          
          await doc.ref.update({ status: "completed", finishedAt: new Date().toISOString() });
          console.log(`Fulfillment [DOCUMENT] completed successfully for ${recipient}`);
        }
      } catch (err) {
        console.error(`Fulfillment failure for task ID ${fulfillmentId}:`, err);
        
        await doc.ref.update({ status: "failed", error: err.message });

        const errorNotification = `⚠️ *Drafting / Fulfillment Notification*
━━━━━━━━━━━━━━━━━
Ref: *${txRef}*

We encountered an error automating your request:
_${err.message}_

Our engineering desk at LBtech has been notified. A support officer will look into the logs and assist you structure your fulfillment manually within 2 hours. Thanks for your patience!`;

        await sendText(sock, recipient, errorNotification);
      }
    }
  } catch (err) {
    console.error("Critical error inside fulfillment poll loop:", err);
  } finally {
    isProcessing = false;
  }
}
