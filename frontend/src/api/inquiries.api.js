import api from "./client";

/**
 * Fetch inquiries for the currently logged-in user
 * @param {string} role - Optional filter: 'seller' | 'buyer' | '' (all)
 */
export async function getMyInquiries(role = "") {
  const params = role ? { role } : {};
  const response = await api.get("/inquiries", { params });
  return response?.data?.inquiries || response?.inquiries || [];
}

/**
 * Send an inquiry message to the car's seller
 * @param {string} carId - MongoDB ObjectId of the car
 * @param {object} payload - { message: string, phone: string }
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
 * Delete an inquiry conversation by ID
 * @param {string} inquiryId - MongoDB ObjectId of the inquiry
 */
export async function deleteInquiry(inquiryId) {
  return await api.delete(`/inquiries/${inquiryId}`);
}
