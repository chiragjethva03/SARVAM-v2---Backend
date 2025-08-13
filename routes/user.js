const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const upload = require("../middleware/multer");
const userController = require("../controllers/userController");

// --- USER PROFILE ---
router.get("/me", protect, userController.getMe);

// --- DELETE ACCOUNT ---
router.delete("/delete", protect, userController.deleteAccount);

// --- UPDATE DETAILS ---
router.put("/update-details", protect, userController.updateDetails);

// --- CHANGE PASSWORD ---
router.put("/change-password", protect, userController.changePassword);

// --- UPLOAD PROFILE PICTURE ---
router.post(
  "/upload-profile-picture",
  protect,
  upload.single("profilePicture"),
  userController.uploadProfilePicture
);

module.exports = router;
