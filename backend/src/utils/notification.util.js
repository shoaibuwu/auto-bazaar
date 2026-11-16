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



