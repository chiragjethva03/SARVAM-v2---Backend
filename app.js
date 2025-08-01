const dotenv = require("dotenv");
dotenv.config(); // Must be first!

const Express = require("express");
const cors = require("cors");
const connectDB = require("./database/connection");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("./models/User");
const cloudinary = require("./config/cloudinary.js");
const upload = require("./middleware/multer.js");
const Post = require("./models/Post.js");
const protect = require("./middleware/authMiddleware.js")
const authMiddleware = require("./middleware/authMiddleware.js")


const app = Express();

app.use(Express.json());
app.use(cors());

connectDB();

app.post("/signup", async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    console.log("Signup request:", req.body);

    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "All fields required" });
    }

    // Check for duplicate email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({ fullName, email, password: hashedPassword });
    await newUser.save();

    // Create JWT token
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
        profilePicture: "", // Added for consistency
      },
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("Login request:", req.body);

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // If the account was created with Google (no password set)
    if (!user.password) {
      return res.status(400).json({
        message:
          "This account was created using Google Sign-In. Please login with Google.",
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Create JWT
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET || "secretkey",
      { expiresIn: "7d" }
    );

    res.json({
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
    res.status(500).json({ message: "Server error" });
  }
});


// GOOGLE SIGN-IN API
app.post("/google-signin", async (req, res) => {
  try {
    const { fullName, email, googleId, profilePicture, authProvider } = req.body;

    if (!email || !googleId) {
      return res.status(400).json({ message: "Invalid Google user data" });
    }

    // Check if user exists
    let user = await User.findOne({ email });

    if (!user) {
      // Create new user
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
      // Update details if user already exists
      user.googleId = googleId;
      user.profilePicture = profilePicture;
      user.authProvider = "google";
      user.lastLogin = new Date();
      await user.save();
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET || "secretkey",
      { expiresIn: "7d" }
    );

    res.json({
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
    res.status(500).json({ message: "Server error" });
  }
}); 

app.post("/create-post", upload.single("image"), async (req, res) => {
  try {
    const { description, location, userId } = req.body;

    if (!description || !location || !userId) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No image provided" });
    }

    // Upload image to Cloudinary
    const streamUpload = (fileBuffer) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "sarvam_posts" },
          (error, result) => {
            if (error) {
              return reject(error);
            }
            resolve(result);
          }
        );
        stream.end(fileBuffer);
      });
    };

    const result = await streamUpload(req.file.buffer);

    // 3. Save Post in MongoDB
    const newPost = new Post({
      userId,
      description,
      location,
      imageUrl: result.secure_url,
    });

    await newPost.save();

    // 4. Update user's postIDs array
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
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/posts", async (req, res) => {
  try {
    const userId = req.query.userId;
    let posts = await Post.find()
      .populate("userId", "fullName profilePicture")
      .sort({ createdAt: -1 });

    // Filter out posts with missing user
    posts = posts.filter(post => post.userId && typeof post.userId === 'object');

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

    res.json({ posts: postsWithLikes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});




// POST /posts/:postId/like - toggle like
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

    res.json({
      likesCount: post.likes.length,
      liked: index === -1,
    });
  } catch (error) {
    console.error("Error toggling like:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/user/me
app.get("/user/me", protect, async (req, res) => {
  try {
    // req.user is set by protect middleware
    res.json(req.user); // send full user data except password
  } catch (err) {
    console.error("Error in /api/user/me:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/user/delete", protect, async (req, res) => {
  try {
    const userId = req.user._id; // set in protect middleware

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await User.findByIdAndDelete(userId);

    res.json({ message: "Account deleted successfully" });
  } catch (err) {
    console.error("Error deleting account:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get('/posts/my', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('postIDs');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find posts using postIDs stored in user document
    const posts = await Post.find({ _id: { $in: user.postIDs } })
      .sort({ createdAt: -1 });

    return res.json({ posts });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
});



app.delete('/posts/:id', authMiddleware, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Ensure post belongs to the user
    if (post.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete' });
    }

    // Delete post
    await Post.findByIdAndDelete(req.params.id);

    // Remove postId from user's postIDs array
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { postIDs: req.params.id },
    });

    return res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
});


app.get("/", (req, res) => {
  res.send("requested accepted.!");
});

app.listen(3000, () => {
  console.log("server start at port number");
});
