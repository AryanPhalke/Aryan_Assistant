import api from "../../utils/axios";

// Asks the backend "who am I?" using the session cookie (sent automatically
// because axios has withCredentials: true).
// Returns the user object if logged in, or null if not logged in / request failed.
const getCurrentUser = async () => {
  try {
    const { data } = await api.get("/api/me");
    return data;
  } catch (error) {
    // A 400 here is normal for visitors who haven't logged in yet
    console.warn(
      "[getCurrentUser] Not logged in or request failed:",
      error.response?.data?.message ?? error.message,
    );
    return null;
  }
};

export default getCurrentUser;
