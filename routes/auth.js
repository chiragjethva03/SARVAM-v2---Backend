const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// Auth Routes
router.post("/signup", authController.signup);

router.post("/login", authController.login);

router.post("/google-signin", authController.googleSignin);

router.post("/validate-email", authController.validateEmail)

router.post("/verify-otp", authController.verifyOtp);

router.post("/reset-password", authController.resetPassword);

module.exports = router;
