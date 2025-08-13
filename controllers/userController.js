const bcrypt = require("bcrypt");
const User = require("../models/User");
const cloudinary = require("../config/cloudinary");

// --- GET ME ---
exports.getMe = async (req, res) => {
  try {
    return res.json(req.user);
  } catch (err) {
    console.error("Error in /me:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// --- DELETE ACCOUNT ---
exports.deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await User.findByIdAndDelete(userId);
    return res.json({ message: "Account deleted successfully" });
  } catch (err) {
    console.error("Error deleting account:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// --- UPDATE DETAILS ---
exports.updateDetails = async (req, res) => {
  try {
    const { fullName, phoneNumber } = req.body;

    if (!fullName) {
      return res.status(400).json({ message: "Full name is required" });
    }

    req.user.fullName = fullName;
    if (phoneNumber) req.user.phoneNumber = phoneNumber;

    await req.user.save();
    return res.json({ success: true, user: req.user });
  } catch (err) {
    console.error("Error in update-details:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// --- CHANGE PASSWORD ---
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const user = await User.findById(req.user._id).select("+password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: "Password change not available for Google Sign-in users",
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// --- UPLOAD PROFILE PICTURE ---
exports.uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const streamUpload = (fileBuffer) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "sarvam_profiles", resource_type: "image" },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        stream.end(fileBuffer);
      });
    };

    const result = await streamUpload(req.file.buffer);

    const user = await User.findById(req.user._id);
    user.profilePicture = result.secure_url;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile picture updated successfully",
      profilePicture: result.secure_url,
    });
  } catch (error) {
    console.error("Error uploading profile picture:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
