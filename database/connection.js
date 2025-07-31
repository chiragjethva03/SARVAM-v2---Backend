const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_ATLAS, {
      // TLS is enabled automatically for Atlas
      tls: true,
      tlsInsecure: false, // set to true ONLY if you want to skip certificate validation (not recommended)
      serverSelectionTimeoutMS: 5000,
    });

    console.log("MongoDB Connected");
  } catch (error) {
    console.error("Database connection error:", error);
    process.exit(1);
  }
};

module.exports = connectDB;
