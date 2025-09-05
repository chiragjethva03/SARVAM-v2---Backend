const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_ATLAS, {
      serverSelectionTimeoutMS: 5000, // 5s
    });

  console.log("MongoDB Connected");
} catch (error) {
  console.error("Database connection error:", error);
  process.exit(1);
}
};

module.exports = connectDB;
