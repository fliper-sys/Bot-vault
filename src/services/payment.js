/**
 * Flutterwave Integration Service
 * Uses native fetch (Node 18+) to minimize dependency bloat
 */

const FLW_BASE_URL = "https://api.flutterwave.com/v3";

/**
 * Generates a short, human-readable transaction reference
 */
export function generateTxRef() {
  const ts = Date.now().toString().slice(-6);
  const rand = Math.floor(100 + Math.random() * 900); // 3 digit random
  return `BV-${ts}-${rand}`;
}

/**
 * Initializes a transaction check-out link with Flutterwave
 */
export async function initializePayment({ amount, txRef, email, phone, description }) {
  const secretKey = process.env.FLW_SECRET_KEY;
  if (!secretKey) {
    throw new Error("FLW_SECRET_KEY environment variable is not defined");
  }

  // Ensure redirect URL is defined, fallbacks to a default LBtech domain
  const redirectUrl = process.env.FLW_REDIRECT_URL || "https://lbtech.site";

  // Sanitize phone number (remove JID or non-digits)
  const cleanPhone = phone ? phone.split("@")[0].replace(/\D/g, "") : "";

  try {
    const response = await fetch(`${FLW_BASE_URL}/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: amount,
        currency: "NGN",
        redirect_url: redirectUrl,
        customer: {
          email: email || "customer@lbtech.site",
          phonenumber: cleanPhone || "08000000000",
          name: "BotVault WhatsApp User"
        },
        customizations: {
          title: "BotVault by LBtech",
          description: description || "Service Settlement",
          logo: "https://lbtech.site/logo.png"
        }
      })
    });

    const data = await response.json();
    if (response.ok && data.status === "success") {
      return {
        success: true,
        link: data.data.link,
        txRef: txRef
      };
    } else {
      console.error("Flutterwave initialization response failed:", data);
      return {
        success: false,
        error: data.message || "Unknown gateway error"
      };
    }
  } catch (err) {
    console.error("Error connecting to Flutterwave:", err);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Verifies transaction validity on Flutterwave's ledger using Transaction ID is standard.
 * If verified by tx_ref, retrieves details.
 */
export async function verifyPayment(transactionId) {
  const secretKey = process.env.FLW_SECRET_KEY;
  if (!secretKey) {
    throw new Error("FLW_SECRET_KEY is required for verification");
  }

  try {
    const url = `${FLW_BASE_URL}/transactions/${transactionId}/verify`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json"
      }
    });

    const data = await response.json();
    if (response.ok && data.status === "success") {
      const tx = data.data;
      if (tx.status === "successful" || tx.status === "success") {
        return {
          success: true,
          txRef: tx.tx_ref,
          amount: tx.amount,
          currency: tx.currency,
          status: tx.status
        };
      }
    }
    return { success: false, error: data?.message || "Transaction verification failed" };
  } catch (err) {
    console.error(`Error verifying transaction ${transactionId}:`, err);
    return { success: false, error: err.message };
  }
}

/**
 * Verifies transaction validity on Flutterwave's ledger using the txRef reference
 */
export async function verifyPaymentByRef(txRef) {
  const secretKey = process.env.FLW_SECRET_KEY;
  if (!secretKey) {
    throw new Error("FLW_SECRET_KEY is required for verification");
  }

  try {
    const url = `${FLW_BASE_URL}/transactions/verify_by_reference?tx_ref=${txRef}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json"
      }
    });

    const data = await response.json();
    if (response.ok && data.status === "success") {
      const tx = data.data;
      if (tx.status === "successful" || tx.status === "success") {
        return {
          success: true,
          txRef: tx.tx_ref,
          amount: tx.amount,
          currency: tx.currency,
          status: tx.status,
          transactionId: tx.id
        };
      }
    }
    return { success: false, error: data?.message || "Verify by reference failed" };
  } catch (err) {
    console.error(`Error verifying transaction by ref ${txRef}:`, err);
    return { success: false, error: err.message };
  }
}
