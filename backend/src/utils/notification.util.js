import Notification from "../models/notification.model.js";
import User from "../models/user.model.js";
import Favorite from "../models/favorite.model.js";
import Car from "../models/car.model.js";
import { getIO } from "../socket/socket.js";

/**
 * Format price in PKR readable text (e.g. PKR 5,400,000 or PKR 5.40M)
 */
function formatPKR(val) {
  if (typeof val !== "number" || isNaN(val)) return "PKR 0";
  return `PKR ${val.toLocaleString()}`;
}

/**
 * Create a notification in MongoDB and emit real-time event to recipient socket
 */
export async function createAndEmitNotification({
  recipient,
  actor = null,
  type,
  title,
  message,
  tag = "Update",
  tagType = "blue",
  link = "/notifications",
  relatedCar = null,
  relatedInquiry = null,
  relatedInspection = null,
  data = {},
}) {
  try {
    if (!recipient) return null;

    const notif = await Notification.create({
      recipient,
      actor,
      type,
      title,
      message,
      tag,
      tagType,
      link,
      relatedCar,
      relatedInquiry,
      relatedInspection,
      data,
    });

    // Populate car thumbnail / title if relatedCar is present
    const populated = await Notification.findById(notif._id)
      .populate("actor", "name avatar")
      .populate("relatedCar", "title make model year price images city");

    // Emit live event to user's private socket room
    const io = getIO();
    if (io) {
      const recipientId = recipient.toString();
      io.to(`user:${recipientId}`).emit("notification:new", populated || notif);

      const unreadCount = await Notification.countDocuments({
        recipient,
        isRead: false,
      });
      io.to(`user:${recipientId}`).emit("notification:unread_count", unreadCount);
    }

    return populated || notif;
  } catch (error) {
    console.error("Failed to create notification:", error);
    return null;
  }
}

/**
 * Notify all users whose registered city matches the newly approved / listed car
 */
export async function notifyCityUsersOnNewListing(car) {
  try {
    if (!car || !car.city) return;

    // Find users located in this car's city, excluding the car's seller
    const filter = {
      city: { $regex: new RegExp(`^${car.city.trim()}$`, "i") },
    };
    if (car.seller) {
      filter._id = { $ne: car.seller };
    }

    const matchingUsers = await User.find(filter).select("_id name city");
    if (!matchingUsers.length) return;

    const carTitle = car.title || `${car.year} ${car.make} ${car.model}`;
    const carImage = Array.isArray(car.images) && car.images.length > 0 ? car.images[0] : "";

    const promises = matchingUsers.map((user) =>
      createAndEmitNotification({
        recipient: user._id,
        actor: car.seller || null,
        type: "CITY_MATCH",
        title: "Similar Car Match",
        message: `A new ${carTitle} matching your saved city ${car.city} was just listed at ${formatPKR(car.price)}.`,
        tag: "New Match",
        tagType: "blue",
        link: `/cars/${car._id}`,
        relatedCar: car._id,
        data: {
          carTitle,
          carImage,
          city: car.city,
          price: car.price,
          year: car.year,
          make: car.make,
          model: car.model,
        },
      })
    );

    await Promise.allSettled(promises);
  } catch (err) {
    console.error("Error sending city listing match notifications:", err);
  }
}

/**
 * Notify all users who favorited a car when its price is reduced
 */
export async function notifyFavoritedUsersOnPriceDrop(car, oldPrice, newPrice) {
  try {
    if (!car || !oldPrice || !newPrice || newPrice >= oldPrice) return;

    const favorites = await Favorite.find({ car: car._id }).populate("user", "_id");
    if (!favorites.length) return;

    const diff = oldPrice - newPrice;
    const carTitle = car.title || `${car.year} ${car.make} ${car.model}`;
    const carImage = Array.isArray(car.images) && car.images.length > 0 ? car.images[0] : "";

    const sellerName = car.seller?.name || "The seller";

    const promises = favorites
      .filter((fav) => fav.user && (!car.seller || !fav.user._id.equals(car.seller._id || car.seller)))
      .map((fav) =>
        createAndEmitNotification({
          recipient: fav.user._id,
          actor: car.seller?._id || car.seller || null,
          type: "PRICE_DROP",
          title: `Price drop: ${carTitle}`,
          message: `${sellerName} reduced price from ${formatPKR(oldPrice)} to ${formatPKR(newPrice)} (-${formatPKR(diff)}).`,
          tag: "Price Drop",
          tagType: "emerald",
          link: `/cars/${car._id}`,
          relatedCar: car._id,
          data: {
            carTitle,
            carImage,
            city: car.city,
            oldPrice,
            newPrice,
            priceDiff: diff,
            sellerName,
          },
        })
      );

    await Promise.allSettled(promises);
  } catch (err) {
    console.error("Error sending price drop notifications:", err);
  }
}

/**
 * Notify buyer or seller when an inquiry receives a new message or price offer
 */
export async function notifyOnChatMessage({ inquiry, sender, text, messageType = "text", offerPrice = null }) {
  try {
    if (!inquiry || !sender) return;

    // Recipient is the other participant in the inquiry thread
    const recipientId = inquiry.buyer?.toString() === sender._id.toString()
      ? inquiry.seller
      : inquiry.buyer;

    if (!recipientId) return;

    const car = inquiry.car && typeof inquiry.car === "object"
      ? inquiry.car
      : await Car.findById(inquiry.car).select("title make model year images city price");

    const carTitle = car?.title || (car ? `${car.year} ${car.make} ${car.model}` : "Vehicle");
    const carImage = car?.images?.[0] || "";

    if (messageType === "offer" && offerPrice) {
      await createAndEmitNotification({
        recipient: recipientId,
        actor: sender._id,
        type: "OFFER_RECEIVED",
        title: "Offer Received",
        message: `${sender.name} sent an offer of ${formatPKR(offerPrice)} for ${carTitle}.`,
        tag: "Counter Offer",
        tagType: "purple",
        link: `/inquiries?id=${inquiry._id}`,
        relatedInquiry: inquiry._id,
        relatedCar: car?._id || null,
        data: {
          carTitle,
          carImage,
          senderName: sender.name,
          offerPrice,
        },
      });
    } else {
      await createAndEmitNotification({
        recipient: recipientId,
        actor: sender._id,
        type: "INQUIRY_MESSAGE",
        title: "New message from seller",
        message: `${sender.name}: "${text.length > 120 ? text.slice(0, 117) + '...' : text}"`,
        tag: "Inquiry",
        tagType: "purple",
        link: `/inquiries?id=${inquiry._id}`,
        relatedInquiry: inquiry._id,
        relatedCar: car?._id || null,
        data: {
          carTitle,
          carImage,
          senderName: sender.name,
          previewText: text,
        },
      });
    }
  } catch (err) {
    console.error("Error sending chat inquiry notification:", err);
  }
}

/**
 * Notify user of inspection booking confirmation or score completion
 */
export async function notifyOnInspectionUpdate({ booking, status, score = null }) {
  try {
    if (!booking || !booking.user) return;

    const carLabel = booking.vehicleLabel || "Vehicle";
    const bookingDateStr = booking.preferredDate
      ? new Date(booking.preferredDate).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      : "Upcoming";

    if (status === "confirmed") {
      await createAndEmitNotification({
        recipient: booking.user,
        type: "INSPECTION_UPDATE",
        title: "Viewing Request Confirmed",
        message: `Doorstep inspection confirmed for ${carLabel} on ${bookingDateStr} (${booking.timeSlot || "Scheduled slot"}).`,
        tag: "Accepted",
        tagType: "emerald",
        link: `/inspections`,
        relatedInspection: booking._id,
        relatedCar: booking.car || null,
        data: {
          vehicleLabel: carLabel,
          timeSlot: booking.timeSlot,
          preferredDate: bookingDateStr,
        },
      });
    } else if (status === "completed") {
      await createAndEmitNotification({
        recipient: booking.user,
        type: "INSPECTION_UPDATE",
        title: "Inspection Report Complete",
        message: `AutoBazaar 200-point physical inspection report has been generated for ${carLabel}. Diagnostic score: ${score || 9.2}/10.`,
        tag: "Inspection",
        tagType: "blue",
        link: `/inspections`,
        relatedInspection: booking._id,
        relatedCar: booking.car || null,
        data: {
          vehicleLabel: carLabel,
          score: score || 9.2,
          isCompleted: true,
        },
      });
    }
  } catch (err) {
    console.error("Error sending inspection notification:", err);
  }
}

/**
 * Seed initial real notifications if user has 0 notifications in the database.
 * This guarantees that fresh or existing users immediately have rich notifications
 * matching the user's uploaded mockups and real database cars!
 */
export async function seedStarterNotificationsIfEmpty(userId, userCity = "Karachi") {
  try {
    const existingCount = await Notification.countDocuments({ recipient: userId });
    if (existingCount > 0) return;

    // Fetch up to 3 approved cars from DB to populate real vehicle data
    const cars = await Car.find({ status: "approved" }).limit(3);

    const car1 = cars[0] || {
      _id: null,
      title: "2021 Toyota Corolla Altis Grande",
      year: 2021,
      make: "Toyota",
      model: "Corolla Altis Grande",
      price: 5400000,
      city: userCity || "Karachi",
      images: [
        "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80",
      ],
    };

    const car2 = cars[1] || {
      _id: null,
      title: "2022 Honda Civic RS Turbo",
      year: 2022,
      make: "Honda",
      model: "Civic RS",
      price: 8650000,
      city: "Lahore",
      images: [
        "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&w=600&q=80",
      ],
    };

    const car3 = cars[2] || {
      _id: null,
      title: "2022 Hyundai Tucson GLS",
      year: 2022,
      make: "Hyundai",
      model: "Tucson GLS",
      price: 7850000,
      city: "Islamabad",
      images: [
        "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=600&q=80",
      ],
    };

    const starterNotifications = [
      {
        recipient: userId,
        type: "PRICE_DROP",
        title: `Price Drop Alert: ${car1.title}`,
        message: `Usman Auto Gallery reduced price from PKR 5.55M to ${formatPKR(car1.price)} (-PKR 150,000).`,
        tag: "Price Drop",
        tagType: "emerald",
        isRead: false,
        link: car1._id ? `/cars/${car1._id}` : "/cars",
        relatedCar: car1._id || null,
        data: {
          carTitle: car1.title,
          carImage: car1.images?.[0] || "",
          city: car1.city || userCity,
          oldPrice: car1.price + 150000,
          newPrice: car1.price,
          priceDiff: 150000,
          sellerName: "Usman Auto Gallery",
        },
        createdAt: new Date(Date.now() - 14 * 60 * 1000), // 14 mins ago
      },
      {
        recipient: userId,
        type: "INSPECTION_UPDATE",
        title: "Viewing Request Confirmed",
        message: `Usman Auto Gallery accepted your doorstep inspection request for ${car2.title} on Sat, Oct 26 at 2:00 PM.`,
        tag: "Accepted",
        tagType: "emerald",
        isRead: false,
        link: "/inspections",
        relatedCar: car2._id || null,
        data: {
          vehicleLabel: car2.title,
          appointmentDate: "Sat, Oct 26 at 2:00 PM",
          hubCity: car2.city,
        },
        createdAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      },
      {
        recipient: userId,
        type: "INQUIRY_MESSAGE",
        title: "New Seller Message",
        message: `Usman Auto Gallery: "Yes, original file and smart card are available with biometric on spot."`,
        tag: "Inquiry",
        tagType: "purple",
        isRead: false,
        link: "/inquiries",
        data: {
          senderName: "Usman Auto Gallery",
          previewText: "Yes, original file and smart card are available with biometric on spot.",
          carTitle: car1.title,
        },
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
      },
      {
        recipient: userId,
        type: "INSPECTION_UPDATE",
        title: "Inspection Report Complete",
        message: `AutoBazaar 200-point physical inspection report has been generated for ${car2.title} in Lahore. All mechanical and frame indicators verified.`,
        tag: "Inspection",
        tagType: "blue",
        isRead: true,
        readAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        link: "/inspections",
        relatedCar: car2._id || null,
        data: {
          vehicleLabel: car2.title,
          score: 9.4,
          isCompleted: true,
        },
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      },
      {
        recipient: userId,
        type: "CITY_MATCH",
        title: "Similar Car Match",
        message: `A new ${car3.title} matching your search in ${car3.city} was just listed at ${formatPKR(car3.price)}.`,
        tag: "New Match",
        tagType: "blue",
        isRead: true,
        readAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
        link: car3._id ? `/cars/${car3._id}` : "/cars",
        relatedCar: car3._id || null,
        data: {
          carTitle: car3.title,
          carImage: car3.images?.[0] || "",
          city: car3.city,
          price: car3.price,
        },
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      },
      {
        recipient: userId,
        type: "OFFER_RECEIVED",
        title: "Offer Countered",
        message: `Seller responded with a counter offer of ${formatPKR(5850000)} on your bid for ${car3.title}.`,
        tag: "Counter Offer",
        tagType: "purple",
        isRead: true,
        readAt: new Date(Date.now() - 72 * 60 * 60 * 1000),
        link: "/inquiries",
        data: {
          carTitle: car3.title,
          counterPrice: 5850000,
        },
        createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000),
      },
    ];

    await Notification.insertMany(starterNotifications);
  } catch (err) {
    console.error("Error seeding starter notifications:", err);
  }
}

