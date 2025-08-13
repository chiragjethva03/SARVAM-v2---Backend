const cloudinary = require("../config/cloudinary");
const Post = require("../models/Post");
const User = require("../models/User");

// --- CREATE POST ---
exports.createPost = async (req, res) => {
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
};

// --- FETCH POSTS ---
exports.getPosts = async (req, res) => {
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
};

// --- TOGGLE LIKE ---
exports.toggleLike = async (req, res) => {
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
};

// --- GET MY POSTS ---
exports.getMyPosts = async (req, res) => {
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
};

// --- DELETE POST ---
exports.deletePost = async (req, res) => {
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
};
