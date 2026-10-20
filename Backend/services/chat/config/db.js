import mongoose from "mongoose";

// Connects to MongoDB (connection string comes from MONGODB_URI in .env).
// Called once when the chat service starts.
const connectDb = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("[chat:db] MongoDB connected");
  } catch (error) {
    console.error("[chat:db] MongoDB connection failed:", error.message);
  }
};

export default connectDb;
