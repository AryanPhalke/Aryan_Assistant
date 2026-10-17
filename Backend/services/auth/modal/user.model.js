import mongoose from "mongoose";

// Shape of a user document stored in MongoDB
const userSchema = new mongoose.Schema(
  {
    // Google/Firebase's unique id for this user; used to find them on later logins
    firebaseUid: {
      type: String,
      unique: true,
    },
    name: String,
    email: String,
    avatar: String, // profile picture URL
  },
  {
    // Automatically adds createdAt and updatedAt fields
    timestamps: true,
  },
);

const User = mongoose.model("User", userSchema);

export default User;
