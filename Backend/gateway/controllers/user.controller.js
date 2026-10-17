// Returns the currently logged-in user.
// By the time this runs, the `protect` middleware has already verified the
// session and put the user's data on req.user, so we just send it back.
const getCurrentUser = async (req, res) => {
  try {
    return res.status(200).json(req.user);
  } catch (error) {
    console.error("[gateway:getCurrentUser] Failed:", error.message);
    return res
      .status(500)
      .json({ message: `get current user error: ${error}` });
  }
};

export default getCurrentUser;
