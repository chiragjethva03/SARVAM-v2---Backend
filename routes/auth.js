const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// Auth Routes
router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.post("/google-signin", authController.googleSignin);

module.exports = router;
