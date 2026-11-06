import AuditLog from "../models/auditLog.model.js";
import Car from "../models/car.model.js";
import User from "../models/user.model.js";
import { recordAuditLog } from "./auditLogger.js";

/**
 * Initializes audit log ledger from real database events if empty
 */
export async function seedAuditHistoryIfEmpty() {
  const count = await AuditLog.countDocuments();
  if (count > 0) return; // Already initialized

  console.log("Seeding initial audit ledger from real database entities...");

  const users = await User.find().sort({ createdAt: 1 }).lean();
  const cars = await Car.find().populate("seller", "name email role").sort({ createdAt: 1 }).lean();
  const adminUser = users.find((u) => u.role === "admin") || {
    name: "Platform Administrator",
    email: "admin@autobazaar.com",
    role: "admin",
  };

  // 1. Record User Registrations
  for (const u of users) {
    await recordAuditLog({
      actor: {
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
      },
      action: "USER_REGISTERED",
      actionCategory: "user",
      summary: `User account created: ${u.name} as ${u.role.toUpperCase()}`,
      targetEntity: {
        entityType: "User",
        entityId: String(u._id),
        entityTitle: `${u.name} (${u.email})`,
      },
      ipAddress: "127.0.0.1",
      metadata: { role: u.role, phone: u.phoneNumber },
      timestamp: u.createdAt || new Date(Date.now() - 1000 * 60 * 60 * 24),
    });
  }

  // 2. Record Vehicle Submissions & Approvals
  for (const car of cars) {
    const seller = car.seller || { name: "Seller", email: "seller@autobazaar.com", role: "seller" };

    // Submission event
    await recordAuditLog({
      actor: {
        id: seller._id || null,
        name: seller.name || "Seller",
        email: seller.email || "",
        role: "seller",
      },
      action: "LISTING_SUBMITTED",
      actionCategory: "listing",
      summary: `Listing submitted for moderation: ${car.title} for PKR ${Number(car.price || 0).toLocaleString("en-PK")}`,
      targetEntity: {
        entityType: "Listing",
        entityId: String(car._id),
        entityTitle: car.title,
      },
      ipAddress: "127.0.0.1",
      metadata: { price: car.price, city: car.city },
      timestamp: car.createdAt || new Date(Date.now() - 1000 * 60 * 60 * 12),
    });

    // Approval / Sanction event
    if (car.status === "published") {
      await recordAuditLog({
        actor: {
          id: adminUser._id || null,
          name: adminUser.name || "Platform Administrator",
          email: adminUser.email || "admin@autobazaar.com",
          role: "admin",
        },
        action: "LISTING_APPROVED",
        actionCategory: "admin",
        summary: `Admin approved vehicle listing: ${car.title} published live on marketplace`,
        targetEntity: {
          entityType: "Listing",
          entityId: String(car._id),
          entityTitle: car.title,
        },
        ipAddress: "127.0.0.1",
        metadata: { newStatus: "published", approvedBy: adminUser.email },
        timestamp: car.updatedAt || new Date(Date.now() - 1000 * 60 * 60 * 4),
      });
    } else if (car.status === "rejected") {
      await recordAuditLog({
        actor: {
          id: adminUser._id || null,
          name: adminUser.name || "Platform Administrator",
          email: adminUser.email || "admin@autobazaar.com",
          role: "admin",
        },
        action: "LISTING_DELISTED",
        actionCategory: "admin",
        summary: `Admin suspended/delisted listing: ${car.title}. Reason: ${car.rejectionReason || "Under review"}`,
        targetEntity: {
          entityType: "Listing",
          entityId: String(car._id),
          entityTitle: car.title,
        },
        ipAddress: "127.0.0.1",
        metadata: { rejectionReason: car.rejectionReason },
        timestamp: car.updatedAt || new Date(Date.now() - 1000 * 60 * 60 * 2),
      });
    }
  }

  console.log("Audit ledger successfully initialized with real entity history.");
}

