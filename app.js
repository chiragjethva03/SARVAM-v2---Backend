const dotenv = require("dotenv");
dotenv.config(); // Load env first!

const Express = require("express");
const cors = require("cors");
const connectDB = require("./database/connection");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("./models/User");
const cloudinary = require("./config/cloudinary.js");
const upload = require("./middleware/multer.js");
const Post = require("./models/Post.js");
const protect = require("./middleware/authMiddleware.js");
const authMiddleware = require("./middleware/authMiddleware.js");

const app = Express();

// Middlewares
app.use(Express.json());
app.use(cors());

// Connect DB
connectDB();

// --- SIGNUP ---
app.post("/signup", async (req, res) => {
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
});

// --- LOGIN ---
app.post("/login", async (req, res) => {
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
});

// --- GOOGLE SIGN-IN ---
app.post("/google-signin", async (req, res) => {
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
});

// --- CREATE POST ---
app.post("/create-post", upload.single("image"), async (req, res) => {
  try {
    const { description, location, userId } = req.body;

    if (!description || !location || !userId) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No image provided" });
    }

    const streamUpload = (fileBuffer) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "sarvam_posts" },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        stream.end(fileBuffer);
      });
    };

    const result = await streamUpload(req.file.buffer);

    const newPost = new Post({
      userId,
      description,
      location,
      imageUrl: result.secure_url,
    });

    await newPost.save();

    await User.findByIdAndUpdate(
      userId,
      { $push: { postIDs: newPost._id } },
      { new: true }
    );

    return res.status(201).json({
      message: "Post created successfully",
      post: newPost,
    });
  } catch (err) {
    console.error("Error creating post:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// --- FETCH POSTS ---
app.get("/posts", async (req, res) => {
  try {
    const userId = req.query.userId;
    let posts = await Post.find()
      .populate("userId", "fullName profilePicture")
      .sort({ createdAt: -1 });

    posts = posts.filter(
      (post) => post.userId && typeof post.userId === "object"
    );

    const postsWithLikes = posts.map((post) => {
      const liked = userId
        ? post.likes.some((id) => id.toString() === userId)
        : false;

      return {
        ...post.toObject(),
        likesCount: post.likes.length,
        liked,
      };
    });

    return res.json({ posts: postsWithLikes });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// --- TOGGLE LIKE ---
app.post("/:postId/like", async (req, res) => {
  try {
    const { userId } = req.body;
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const index = post.likes.findIndex(
      (id) => id.toString() === userId.toString()
    );

    if (index === -1) {
      post.likes.push(userId);
    } else {
      post.likes.splice(index, 1);
    }

    await post.save();

    return res.json({
      likesCount: post.likes.length,
      liked: index === -1,
    });
  } catch (error) {
    console.error("Error toggling like:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

// --- USER ME ---
app.get("/user/me", protect, async (req, res) => {
  try {
    return res.json(req.user);
  } catch (err) {
    console.error("Error in /api/user/me:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// --- DELETE ACCOUNT ---
app.delete("/user/delete", protect, async (req, res) => {
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
});

// --- MY POSTS ---
app.get("/posts/my", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("postIDs");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const posts = await Post.find({ _id: { $in: user.postIDs } }).sort({
      createdAt: -1,
    });

    return res.json({ posts });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
});

// --- DELETE POST ---
app.delete("/posts/:id", authMiddleware, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (post.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to delete" });
    }

    await Post.findByIdAndDelete(req.params.id);

    await User.findByIdAndUpdate(req.user.id, {
      $pull: { postIDs: req.params.id },
    });

    return res.json({ message: "Post deleted successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
});

// --- UPDATE DETAILS ---
app.put("/user/update-details", protect, async (req, res) => {
  try {
    const { fullName, phoneNumber } = req.body;

    if (!fullName) {
      return res.status(400).json({ message: "Full name is required" });
    }

    req.user.fullName = fullName;

    if (phoneNumber) {
      req.user.phoneNumber = phoneNumber; // ✅ correct field
    }

    await req.user.save();

    return res.json({ success: true, user: req.user }); // ✅ sends updated user
  } catch (err) {
    console.error("Error in update-details:", err);
    return res.status(500).json({ message: "Server error" });
  }
});





// Change Password

app.put("/user/change-password", protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Fetch fresh user from DB with password field included
    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // If the user signed up with Google
    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: "Password change not available for Google Sign-in users",
      });
    }

    // Compare current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Hash and update new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// --- UPLOAD PROFILE PICTURE ---
app.post("/user/upload-profile-picture", protect, upload.single("profilePicture"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const streamUpload = (fileBuffer) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "sarvam_profiles",
            resource_type: "image",
          },
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
});


// --- ROOT ENDPOINT ---
app.get("/", (req, res) => {
  return res.send("requested accepted.!");
});


app.listen(3000, () => {
  console.log("server start at port 3000 number");
});
