import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import User from "../src/models/user.model.js";

const seedAdmin = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error("❌ MONGODB_URI is not defined in .env");
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB for seeding...");

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      console.error(
        "❌ ADMIN_EMAIL and ADMIN_PASSWORD must be set in your secret .env file before running this script."
      );
      process.exit(1);
    }

    // Check if an admin already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log(`⚠️  Admin already exists with email: ${adminEmail}`);
      await mongoose.disconnect();
      process.exit(0);
    }

    // Create the super-admin account (password is hashed automatically by user model pre-save hook)
    const admin = await User.create({
      name: "Platform Administrator",
      email: adminEmail,
      password: adminPassword,
      role: "admin",
      phoneNumber: "+1000000000",
    });

    // console.log("==========================================");
    // console.log("🎉 Super Admin Created Successfully!");
    // console.log(`📧 Email:    ${admin.email}`);
    // console.log(`🔑 Password: ${adminPassword}`);
    // console.log(`🛡️  Role:     ${admin.role}`);
    // console.log("==========================================");

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
};

seedAdmin();
