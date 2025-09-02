const mongoose = require("mongoose");

const MemberSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    mobile: { type: String, index: true },
    name: { type: String },
  },
  { _id: false }
);

const SplitTargetSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    mobile: { type: String },
    shareAmount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const ExpenseLineSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    category: {
      type: String,
      enum: ["travel", "food", "entertainment", "shopping", "others"],
      default: "others",
    },
    paidBy: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      mobile: { type: String },
    },
    splitType: { type: String, enum: ["equal", "unequal"], default: "equal" },
    splitBetween: [SplitTargetSchema],
    date: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ExpenseSchema = new mongoose.Schema(
  {
    groupId: { type: String, unique: true, index: true },
    groupName: { type: String, required: true, trim: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    members: [MemberSchema],
    expenses: [ExpenseLineSchema],
  },
  { timestamps: true }
);

// normalize mobiles
ExpenseSchema.pre("save", function (next) {
  if (this.members && this.members.length) {
    this.members.forEach((m) => {
      if (m.mobile) m.mobile = (m.mobile + "").replace(/\D/g, "").slice(-12);
    });
  }
  if (this.expenses && this.expenses.length) {
    this.expenses.forEach((e) => {
      if (e.paidBy?.mobile)
        e.paidBy.mobile = (e.paidBy.mobile + "").replace(/\D/g, "").slice(-12);
      e.splitBetween?.forEach((s) => {
        if (s.mobile) s.mobile = (s.mobile + "").replace(/\D/g, "").slice(-12);
      });
    });
  }
  next();
});

// generate groupId if missing
ExpenseSchema.pre("save", async function (next) {
  if (!this.groupId) {
    let unique = false;
    while (!unique) {
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const candidate = `SarvamEx${randomNum}`;
      const existing = await mongoose.models.Expense.findOne({ groupId: candidate }).lean();
      if (!existing) {
        this.groupId = candidate;
        unique = true;
      }
    }
  }
  next();
});

module.exports = mongoose.model("Expense", ExpenseSchema);
