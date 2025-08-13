const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");
const upload = require("../middleware/multer");
const authMiddleware = require("../middleware/authMiddleware");

// Create post
router.post("/create-post", upload.single("image"), postController.createPost);

// Fetch all posts
router.get("/posts", postController.getPosts);

// Toggle like
router.post("/:postId/like", postController.toggleLike);

// Get my posts
router.get("/posts/my", authMiddleware, postController.getMyPosts);

// Delete post
router.delete("/posts/:id", authMiddleware, postController.deletePost);

module.exports = router;
