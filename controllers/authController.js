const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../models/User");

// --- SIGNUP ---
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
