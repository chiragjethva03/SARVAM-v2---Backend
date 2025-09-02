const dotenv = require("dotenv");
const Expense = require('./models/Expense.js');
dotenv.config(); // Load env first!
const mongoose = require("mongoose");
const User = require("./models/User.js");


const Express = require("express");
const cors = require("cors");
const connectDB = require("./database/connection");


const app = Express();

// Middlewares
app.use(Express.json());
app.use(cors());

// Connect DB
connectDB();

// --- Authentication routes --- //
const authRoutes = require("./routes/auth.js");
app.use("/", authRoutes);

// --- Post routes --- // 
const postRoutes = require("./routes/post.js");
app.use("/", postRoutes);

// --- USER routes --- //
const userRoutes = require("./routes/user.js");
app.use("/user", userRoutes);

app.post("/api/expenses/group-with-expense", async (req, res) => {
  try {
    const { groupName, createdBy, members = [], expense } = req.body;

    if (!groupName || !createdBy || !expense) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // ✅ create proper ObjectId
    const creatorId = new mongoose.Types.ObjectId(createdBy);
    
    const newExpenseDoc = new Expense({
      groupName,
      createdBy: creatorId,
      members,
      expenses: [expense],
    });

    await newExpenseDoc.save();

    // ✅ add back-reference to User
    await User.updateOne(
      { _id: creatorId },
      { $addToSet: { expenses: newExpenseDoc._id } } // use "expenses" array field
    );

    return res.status(201).json(newExpenseDoc);
  } catch (err) {
    console.error("Error creating group:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// GET /api/expenses/my-groups?userId=...&/or mobile=...
app.get("/api/expenses/my-groups", async (req, res) => {
  try {
    const { userId, mobile } = req.query;
    if (!userId && !mobile) return res.status(400).json({ error: "userId or mobile required" });

    const norm = (m) => (m || "").replace(/\D/g, "").slice(-12);
    const or = [];
    if (userId) or.push({ "members.userId": userId });
    if (mobile) or.push({ "members.mobile": norm(mobile) });

    const groups = await Expense.find({ $or: or })
      .select("_id groupId groupName createdBy members expenses")
      .sort({ updatedAt: -1 })
      .lean();

    res.json(groups);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// --- ROOT ENDPOINT --- //
app.get("/", (req, res) => {
  return res.send("requested accepted.!");
});

app.listen(3000, () => {
  console.log("server start at port 3000 number");
});
