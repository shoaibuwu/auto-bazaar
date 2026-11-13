import api from "./client";

/**
 * Fetch full profile and account statistics of the currently authenticated user
 */
export const getUserProfile = async () => {
  const response = await api.get("/users/profile");
  if (response.success && response.data) {
    return response.data; // { user, stats }
  }
  throw new Error(response.message || "Failed to load user profile");
};

/**
 * Update personal profile information (name, phoneNumber, city, avatar)
 */
export const updateUserProfile = async (payload) => {
  const response = await api.patch("/users/profile", payload);
  if (response.success && response.data?.user) {
    return response.data.user;
  }
  throw new Error(response.message || "Failed to update profile");
};

/**
 * Change account password
 */
export const changeUserPassword = async ({ currentPassword, newPassword }) => {
  const response = await api.patch("/users/change-password", {
    currentPassword,
    newPassword,
  });
  if (response.success) {
    return response;
  }
  throw new Error(response.message || "Failed to change password");
};

