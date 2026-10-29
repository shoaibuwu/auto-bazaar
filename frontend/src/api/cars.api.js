import api from "./client";

const BACKEND_BASE = "http://localhost:5000";

/**
 * Format a raw MongoDB car document for UI components
 */
export const formatCar = (car) => {
  if (!car) return null;

  const rawImg = car.images && car.images.length > 0 ? car.images[0] : null;
  const imgUrl = rawImg
    ? (rawImg.startsWith("http") ? rawImg : `${BACKEND_BASE}${rawImg}`)
    : "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80";

  return {
    id: car._id,
    title: `${car.year} ${car.make} ${car.model}`,
    make: car.make,
    model: car.model,
    price: car.price,
    priceFormatted: `PKR ${car.price?.toLocaleString("en-PK")}`,
    year: car.year,
    mileage: `${car.mileage?.toLocaleString("en-PK")} km`,
    fuel: car.fuelType ? (car.fuelType.charAt(0).toUpperCase() + car.fuelType.slice(1)) : "Petrol",
    city: car.city ? (car.city.charAt(0).toUpperCase() + car.city.slice(1)) : "Pakistan",
    bodyType: car.bodyType || "sedan",
    transmission: car.transmission || "Automatic",
    inspectionScore: "9.5/10",
    isVerified: true,
    image: imgUrl,
    images: (car.images || []).map((img) => (img.startsWith("http") ? img : `${BACKEND_BASE}${img}`)),
    description: car.description || "",
    seller: car.seller || null,
  };
};

/**
 * Fetch published cars from MongoDB
 */
export const getPublishedCars = async (params = {}) => {
  const queryParams = new URLSearchParams({
    status: "published",
    limit: "24",
    ...params,
  });

  const response = await api.get(`/cars?${queryParams.toString()}`);
  if (response.success && response.data?.cars) {
    return response.data.cars.map(formatCar);
  }
  return [];
};

/**
 * Toggle favorite on a car
 */
export const toggleFavoriteCar = async (carId) => {
  return await api.post(`/favorites/${carId}`);
};

/**
 * Fetch current user's favorites
 */
export const getUserFavorites = async () => {
  const response = await api.get("/favorites");
  if (response.success && response.data?.favorites) {
    return response.data.favorites.map((f) => f.car?._id || f.car).filter(Boolean);
  }
  return [];
};

/**
 * Fetch a single car by its ID
 */
export const getCarById = async (carId) => {
  const response = await api.get(`/cars/${carId}`);
  if (response.success && response.data?.car) {
    return formatCar(response.data.car);
  }
  throw new Error(response.message || "Car listing not found");
};

/**
 * Send an inquiry message to the car's seller
 */
export const sendCarInquiry = async (carId, { message, phoneNumber = "" }) => {
  return await api.post(`/inquiries/${carId}`, { message, phoneNumber });
};

/**
 * Create a new car listing (Sends multipart/form-data with photos)
 */
export const createCar = async (formData) => {
  const response = await api.post("/cars", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  if (response.success && response.data?.car) {
    return formatCar(response.data.car);
  }
  throw new Error(response.message || "Failed to create vehicle listing");
};

/**
 * Fetch all cars owned by the currently logged-in seller
 */
export const getMyListings = async () => {
  const response = await api.get("/cars/my-listings");
  if (response.success && response.data?.cars) {
    return response.data.cars.map(formatCar);
  }
  return [];
};

/**
 * Submit a draft car for admin review
 */
export const submitCarForReview = async (carId) => {
  const response = await api.patch(`/cars/${carId}/submit`);
  if (response.success && response.data?.car) {
    return formatCar(response.data.car);
  }
  throw new Error(response.message || "Failed to submit car for review");
};

/**
 * Mark a published vehicle as sold
 */
export const markCarAsSold = async (carId) => {
  const response = await api.patch(`/cars/${carId}/sold`);
  if (response.success && response.data?.car) {
    return formatCar(response.data.car);
  }
  throw new Error(response.message || "Failed to mark vehicle as sold");
};

/**
 * Delete a draft or rejected vehicle listing
 */
export const deleteCar = async (carId) => {
  return await api.delete(`/cars/${carId}`);
};
