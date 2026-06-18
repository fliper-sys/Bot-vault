import { db } from "../config/firebase.js";

/**
 * Service for Firestore orders & fulfillment records.
 * Secure writes and transaction tracking.
 */

const ORDERS_COLLECTION = "orders";
const FULFILLMENTS_COLLECTION = "fulfillments";

/**
 * Creates a new order in Firestore
 */
export async function createOrder(orderData) {
  try {
    const payload = {
      ...orderData,
      status: orderData.status || "pending",
      createdAt: orderData.createdAt || new Date().toISOString()
    };
    const docRef = await db.collection(ORDERS_COLLECTION).add(payload);
    console.log(`Order created in Firestore with ID: ${docRef.id}, txRef: ${payload.txRef}`);
    return { id: docRef.id, ...payload };
  } catch (err) {
    console.error("Error creating order:", err);
    throw err;
  }
}

/**
 * Updates order status to 'paid' and triggers fulfillment setup
 */
export async function updateOrderStatus(txRef, status = "paid") {
  try {
    const orderQuery = await db.collection(ORDERS_COLLECTION).where("txRef", "==", txRef).limit(1).get();
    
    if (orderQuery.empty) {
      console.warn(`Order not found for txRef: ${txRef}`);
      return false;
    }

    const orderDoc = orderQuery.docs[0];
    const orderData = orderDoc.data();

    if (orderData.status === "paid" && status === "paid") {
      console.log(`Order ${txRef} is already processed.`);
      return true;
    }

    // Update order status
    await orderDoc.ref.update({
      status: status,
      paidAt: new Date().toISOString()
    });
    console.log(`Order ${txRef} updated to status: ${status}`);

    if (status === "paid") {
      // Setup the automatic fulfillment task
      const fulfillmentPayload = {
        orderId: orderDoc.id,
        txRef: txRef,
        type: orderData.type, // DATA, ASSIGNMENT, DOCUMENT
        phoneNumber: orderData.phoneNumber || "", // Target list for data sub
        recipient: orderData.phone, // WhatsApp JID
        status: "pending",
        createdAt: new Date().toISOString(),
        data: {
          ...orderData,
          id: orderDoc.id
        }
      };

      await db.collection(FULFILLMENTS_COLLECTION).add(fulfillmentPayload);
      console.log(`Fulfillment scheduled for order: ${txRef}`);
    }

    return true;
  } catch (err) {
    console.error(`Error updating order status for ${txRef}:`, err);
    throw err;
  }
}

/**
 * Retrieves a single order by its transaction reference identifier
 */
export async function getOrderByTxRef(txRef) {
  try {
    const query = await db.collection(ORDERS_COLLECTION).where("txRef", "==", txRef).limit(1).get();
    if (query.empty) return null;
    return { id: query.docs[0].id, ...query.docs[0].data() };
  } catch (err) {
    console.error(`Error fetching order by txRef ${txRef}:`, err);
    return null;
  }
}

/**
 * Gets the last 5 orders for a specific user phone number
 */
export async function getUserOrders(userPhone) {
  try {
    const phoneNum = userPhone.split("@")[0];
    const query = await db.collection(ORDERS_COLLECTION)
      .where("phone", "==", userPhone)
      .orderBy("createdAt", "desc")
      .limit(5)
      .get();

    const orders = [];
    query.forEach(doc => {
      orders.push({ id: doc.id, ...doc.data() });
    });
    return orders;
  } catch (err) {
    console.error(`Error getting user orders for ${userPhone}:`, err);
    return [];
  }
}
