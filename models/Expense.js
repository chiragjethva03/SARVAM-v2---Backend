// models/Expense.js
const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema({
    groupName: {
        type: String,
        required: true,
        trim: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // Reference to the user who created the group
        required: true
    },
    members: [
        {
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            },
            joinedAt: {
                type: Date,
                default: Date.now
            }
        }
    ],
    expenses: [
        {
            description: {
                type: String,
                required: true
            },
            amount: {
                type: Number,
                required: true
            },
            category: {
                type: String,
                enum: ["Travel", "Food", "Office", "Party", "Other"],
                default: "Other"
            }
            ,
            paidBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true
            },
            date: {
                type: Date,
                default: Date.now
            }
        }
    ],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Expense", expenseSchema);
