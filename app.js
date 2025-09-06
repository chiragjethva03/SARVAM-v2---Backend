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

    const creatorId = new mongoose.Types.ObjectId(createdBy);

    // 1️⃣ Create the group with first expense
    const newExpenseDoc = new Expense({
      groupName,
      createdBy: creatorId,
      members,
      expenses: [expense],
    });
    await newExpenseDoc.save();

    // 2️⃣ Collect all participant IDs
    const participantIds = [creatorId];

    // 2a️⃣ Members with userId
    members.forEach((m) => {
      if (m.userId) participantIds.push(new mongoose.Types.ObjectId(m.userId));
    });

    // 2b️⃣ Members with only mobile
    const mobileMembers = members.filter((m) => !m.userId && m.mobile);
    if (mobileMembers.length) {
      const mobiles = mobileMembers.map((m) =>
        (m.mobile + "").replace(/\D/g, "").slice(-10) // assuming 10-digit local numbers
      );

      // Find users in one query
      const users = await User.find({
        phoneNumber: { $in: mobiles }
      }).select("_id").lean();

      users.forEach((u) => participantIds.push(u._id));
    }

    // 3️⃣ Update all participants with this expense
    await User.updateMany(
      { _id: { $in: participantIds } },
      { $addToSet: { expenses: newExpenseDoc._id } }
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

app.get("/api/expenses/groups/:id", async (req, res) => {
  try {
    const groupId = req.params.id;

    // Find group and populate expenses
    const group = await Expense.findById(groupId)
      .populate({
        path: "expenses",
        model: Expense,
      })
      .lean();

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Structure response to match Flutter needs
    res.json({
      _id: group._id,
      groupName: group.groupName,
      createdBy: group.createdBy,
      members: group.members,
      expenses: group.expenses.map((e) => ({
        _id: e._id,
        title: e.title,
        amount: e.amount,
        category: e.category,
        paidBy: e.paidBy,
        splitType: e.splitType,
        splitBetween: e.splitBetween,
        createdAt: e.createdAt,
      })),
      groupId: group.groupId,
      createdAt: group.createdAt,
    });
  } catch (err) {
    console.error("Error fetching group:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/expenses/delete/:id", async (req, res) => {
  const groupId = req.params.id; // ✅ now this will get the actual group ID
  console.log("Deleting group with ID:", groupId);
  try {
    // Find and delete the group
    const deletedGroup = await Expense.findByIdAndDelete(groupId);

    if (!deletedGroup) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Remove the group ID from all users’ expenses
    await User.updateMany(
      { expenses: groupId },
      { $pull: { expenses: groupId } }
    );

    res.json({ message: "Group deleted successfully", group: deletedGroup });
  } catch (err) {
    console.error("Error deleting group:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});




// --- ROOT ENDPOINT --- //
app.get("/", (req, res) => {
  return res.send("requested accepted.!");
});


app.listen(3000, () => {
  console.log("server start at port 3000 number");
});

