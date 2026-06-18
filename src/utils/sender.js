/**
 * WhatsApp Message Send Helpers
 * Wraps Baileys socket methods with typing indicator presence emulation
 */

/**
 * Delays execution for a specified number of milliseconds
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends a standard text message with a professional typing indicator prefix look-and-feel
 */
export async function sendText(sock, jid, text) {
  if (!sock) {
    console.error(`Cannot send text. Socket not active for recipient ${jid}`);
    return;
  }
  try {
    // Send standard typing presence update
    await sock.sendPresenceUpdate("composing", jid);
    
    // Simulate natural typing rhythm (at least 1.5 seconds)
    await delay(1500);
    
    await sock.sendPresenceUpdate("paused", jid);
    
    const sent = await sock.sendMessage(jid, { text });
    return sent;
  } catch (err) {
    console.error(`Error sending text to ${jid}:`, err);
  }
}

/**
 * Sends a generated .docx document file to the recipient
 */
export async function sendDocument(sock, jid, fileBuffer, fileName, captionText = "") {
  if (!sock) {
    console.error(`Cannot send document file. Socket not active for JID ${jid}`);
    return;
  }
  try {
    // Emulate standard typing presence update
    await sock.sendPresenceUpdate("composing", jid);
    await delay(2000);
    await sock.sendPresenceUpdate("paused", jid);

    const docMsg = {
      document: fileBuffer,
      mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileName: fileName || "BotVault-Document.docx",
      caption: captionText
    };

    const sent = await sock.sendMessage(jid, docMsg);
    console.log(`Document [${fileName}] delivered successfully to ${jid}`);
    return sent;
  } catch (err) {
    console.error(`Error sending document files to ${jid}:`, err);
    throw err;
  }
}
