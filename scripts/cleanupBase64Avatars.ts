import mongoose from "mongoose";
import UserModel from "../models/user.model";
import { generateAvatar } from "../utils/userHelpers";
import "dotenv/config";

/**
 * This script finds all users with base64-encoded avatars
 * and replaces them with generated UI Avatars URLs
 */

const cleanupBase64Avatars = async () => {
  try {
    // Connect to MongoDB
    const DB_URI = process.env.DB_URI;
    if (!DB_URI) {
      console.error("❌ DB_URI not found in environment variables");
      process.exit(1);
    }

    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(DB_URI);
    console.log("✅ Connected to MongoDB");

    // Find all users with base64 avatars
    const usersWithBase64 = await UserModel.find({
      avatar: { $regex: /^data:image\// }
    });

    console.log(`\n📊 Found ${usersWithBase64.length} users with base64 avatars`);

    if (usersWithBase64.length === 0) {
      console.log("✨ No cleanup needed!");
      await mongoose.disconnect();
      process.exit(0);
    }

    let updatedCount = 0;

    // Update each user
    for (const user of usersWithBase64) {
      // Generate a new avatar URL based on user's name
      const displayName = user.firstName
        ? `${user.firstName} ${user.lastName || ''}`.trim()
        : user.name || user.email;

      const newAvatar = generateAvatar(displayName);

      // Update the user
      await UserModel.findByIdAndUpdate(user._id, {
        avatar: newAvatar
      });

      updatedCount++;
      console.log(`✅ Updated ${displayName} (${user.email})`);
      console.log(`   Old: data:image/... (${user.avatar?.length || 0} characters)`);
      console.log(`   New: ${newAvatar}\n`);
    }

    console.log(`\n🎉 Successfully updated ${updatedCount} users!`);
    console.log(`💾 Database space saved: ~${Math.round(usersWithBase64.reduce((acc, u) => acc + (u.avatar?.length || 0), 0) / 1024)}KB`);

    await mongoose.disconnect();
    console.log("\n👋 Disconnected from MongoDB");
    process.exit(0);

  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

cleanupBase64Avatars();
