import mongoose from "mongoose";

// Connects to MongoDB (connection string comes from MONGODB_URI in .env).
// Called once when the auth service starts.
const connectDb = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("[auth:db] MongoDB connected");
  } catch (error) {
    console.error("[auth:db] MongoDB connection failed:", error.message);
  }
};

export default connectDb;
