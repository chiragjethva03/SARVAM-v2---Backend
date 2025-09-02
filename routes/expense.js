// routes/expenseRoutes.js
const express = require("express");
const router = express.Router();
const Expense = require("../models/Expense");// your schema

// Create Expense Group + Expense
router.post("/create", async (req, res) => {
  try {
    const {
      groupName,
      createdBy,
      members,
      expense // { title, amount, category, paidBy, splitType, splitBetween }
    } = req.body;

    const newGroup = new Expense({
      groupName,
      createdBy,
      members,
      expenses: [expense]
    });

    await newGroup.save();
    res.status(201).json({ success: true, data: newGroup });
  } catch (err) {
    console.error("Error creating expense group:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
