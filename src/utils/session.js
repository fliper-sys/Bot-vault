import { db } from "../config/firebase.js";

/**
 * Session persistence utility backed by Firestore.
 * Prevents session data loss when the bot process restarts.
 */

const COLLECTION = "sessions";

/**
 * Normalizes JID keys (e.g. 2348012345678@s.whatsapp.net -> 2348012345678)
 */
function cleanJid(jid) {
  if (!jid) return "default";
  return jid.split("@")[0];
}

/**
 * Gets a user's session or returns a default MAIN_MENU state
 */
export async function getSession(userId) {
  const sessionId = cleanJid(userId);
  try {
    const doc = await db.collection(COLLECTION).doc(sessionId).get();
    if (doc.exists) {
      return doc.data();
    }
  } catch (err) {
    console.error(`Error fetching session for ${sessionId}:`, err);
  }

  // Return fresh session state
  return {
    state: "MAIN_MENU",
    data: {},
    updatedAt: new Date().toISOString()
  };
}

/**
 * Updates a user's session
 */
export async function setSession(userId, state, data = {}) {
  const sessionId = cleanJid(userId);
  try {
    const payload = {
      state,
      data,
      updatedAt: new Date().toISOString()
    };
    await db.collection(COLLECTION).doc(sessionId).set(payload, { merge: true });
    return payload;
  } catch (err) {
    console.error(`Error updating session for ${sessionId}:`, err);
    throw err;
  }
}

/**
 * Clears or resets a user session back to MAIN_MENU
 */
export async function clearSession(userId) {
  const sessionId = cleanJid(userId);
  try {
    const payload = {
      state: "MAIN_MENU",
      data: {},
      updatedAt: new Date().toISOString()
    };
    await db.collection(COLLECTION).doc(sessionId).set(payload);
    return payload;
  } catch (err) {
    console.error(`Error clearing session for ${sessionId}:`, err);
    throw err;
  }
}
