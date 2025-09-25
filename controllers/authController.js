const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const {generateOtp, sendOtpEmail} = require("../utils/sendOtp");


exports.signup = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    console.log("Signup request:", req.body);

    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "All fields required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({ fullName, email, password: hashedPassword });
    await newUser.save();

    const token = jwt.sign(
      { id: newUser._id, email: newUser.email },
      process.env.JWT_SECRET || "secretkey",
      { expiresIn: "7d" }
    );

    return res.json({
      message: "Signup is done",
      token,
      user: {
        id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        profilePicture: "",
      },
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// --- LOGIN ---
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("Login request:", req.body);

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    if (!user.password) {
      return res.status(400).json({
        message:
          "This account was created using Google Sign-In. Please login with Google.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET || "secretkey",
      { expiresIn: "7d" }
    );

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        profilePicture: user.profilePicture || "",
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// --- GOOGLE SIGN-IN ---
exports.googleSignin = async (req, res) => {
  try {
    const { fullName, email, googleId, profilePicture } = req.body;

    if (!email || !googleId) {
      return res.status(400).json({ message: "Invalid Google user data" });
    }

    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        fullName,
        email,
        googleId,
        profilePicture,
        authProvider: "google",
        isEmailVerified: true,
        accountStatus: "active",
        lastLogin: new Date(),
      });
      await user.save();
    } else {
      user.googleId = googleId;
      user.profilePicture = profilePicture;
      user.authProvider = "google";
      user.lastLogin = new Date();
      await user.save();
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET || "secretkey",
      { expiresIn: "7d" }
    );

    return res.json({
      message: "Google sign-in successful",
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        profilePicture: user.profilePicture,
        authProvider: user.authProvider,
      },
    });
  } catch (err) {
    console.error("Google Sign-in error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


exports.validateEmail = async (req, res) => {
  try {
    const { email } = req.body;
    console.log("Validating email:", email);

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email required" });
    }

    const user = await User.findOne({ email: email.trim() });

    if (!user) {
      return res.json({
        success: false,
        action: "not_found",
        message: "Email not registered",
      });
    }

    if (user.authProvider === "google") {
      return res.json({
        success: true,
        action: "google",
        message:
          "This account was created using Google. Please sign in with Google.",
      });
    }

    if (user.authProvider === "manual") {
      // generate OTP
      const otp = generateOtp(); // e.g., 4-6 digit random number

      // save OTP & expiry in DB
      user.otp = otp;
      user.otpExpiry = Date.now() + 10 * 60 * 1000; // 10 min expiry
      await user.save();

      try {
        await sendOtpEmail(email, otp); // send email
        return res.json({
          success: true,
          action: "manual",
          message: "OTP sent to your email.",
        });
      } catch (mailError) {
        console.error("Error sending OTP:", mailError);
        return res.json({
          success: false,
          action: "manual",
          message: "Failed to send OTP. Try again later.",
        });
      }
    }

    return res.json({
      success: false,
      action: "unknown",
      message: "Auth provider not recognized.",
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, message: "Server error, please try again" });
  }
}

exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res
        .status(400)
        .json({ success: false, message: "Email and OTP are required" });
    }

    const user = await User.findOne({ email: email.trim() });

    if (!user) {
      return res.json({ success: false, message: "Email not registered" });
    }

    // Check if OTP exists & not expired
    if (!user.otp || !user.otpExpiry || Date.now() > user.otpExpiry) {
      return res.json({
        success: false,
        message: "OTP expired or not found. Please request a new one.",
      });
    }

    // Compare OTP
    if (user.otp !== otp) {
      return res.json({
        success: false,
        message: "Invalid OTP. Please try again.",
      });
    }

    // ✅ OTP is correct -> clear OTP
    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    return res.json({
      success: true,
      message: "OTP verified successfully. You can reset your password now.",
    });
  } catch (err) {
    console.error("Error verifying OTP:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error, please try again" });
  }
}

exports.resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res
        .status(400)
        .json({ success: false, message: "Email and new password are required" });
    }

    const user = await User.findOne({ email: email.trim() });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Email not registered" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in DB
    user.password = hashedPassword;
    await user.save();

    return res.json({
      success: true,
      message: "Password reset successfully. You can now login with your new password.",
    });
  } catch (err) {
    console.error("Error resetting password:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error. Please try again." });
  }
}