import api from "./client";

/**
 * Fetch inquiries + unread count summary for the logged-in user
 * @param {string} role - Optional filter: 'seller' | 'buyer' | '' (all)
 */
export async function getMyInquiriesWithMeta(role = "") {
  const params = role ? { role } : {};
  const response = await api.get("/inquiries", { params });
  const data = response?.data || response || {};
  return {
    inquiries: data.inquiries || [],
    totalUnread: data.totalUnread || 0,
    count: data.count || (data.inquiries ? data.inquiries.length : 0),
  };
}

/**
 * Fetch inquiries array for the currently logged-in user
 * @param {string} role - Optional filter: 'seller' | 'buyer' | '' (all)
 */
export async function getMyInquiries(role = "") {
  const { inquiries } = await getMyInquiriesWithMeta(role);
  return inquiries;
}

/**
 * Fetch a single inquiry conversation thread by ID (marks messages read)
 * @param {string} inquiryId
 */
export async function getInquiryById(inquiryId) {
  const response = await api.get(`/inquiries/${inquiryId}`);
  return response?.data?.inquiry || response?.inquiry;
}

/**
 * Send a new initial inquiry (or append to active thread) to a car's seller
 * @param {string} carId
 * @param {object} payload - { message: string, phone?: string, phoneNumber?: string }
 */
export async function sendCarInquiry(carId, { message, phone = "", phoneNumber = "" }) {
  const finalPhone = phone || phoneNumber || "";
  const response = await api.post(`/inquiries/${carId}`, {
    message,
    phone: finalPhone,
  });
  return response?.data?.inquiry || response?.inquiry;
}

/**
 * Send a real-time reply inside an existing inquiry conversation thread
 * @param {string} inquiryId
 * @param {object} payload - { text: string, messageType?: 'text'|'offer'|'viewing', offerPrice?: number }
 */
export async function sendInquiryReply(
  inquiryId,
  { text, messageType = "text", offerPrice = undefined }
) {
  const body = { text, messageType };
  if (messageType === "offer" && offerPrice) {
    body.offerPrice = Number(offerPrice);
  }
  const response = await api.post(`/inquiries/${inquiryId}/messages`, body);
  return response?.data || response;
}

/**
 * Explicitly mark an inquiry conversation as read for the active viewer
 * @param {string} inquiryId
 */
export async function markInquiryRead(inquiryId) {
  return await api.patch(`/inquiries/${inquiryId}/read`);
}

/**
 * Delete an inquiry conversation by ID
 * @param {string} inquiryId
 */
export async function deleteInquiry(inquiryId) {
  return await api.delete(`/inquiries/${inquiryId}`);
}
