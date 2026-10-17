import { createSlice } from "@reduxjs/toolkit";

const userSlice = createSlice({
  name: "user",
  // initial state similar to useState in react
  initialState: {
    userData: null,
  },
  // reducers: updates the initialState
  reducers: {
    setUserdata: (state, action) => {
      state.userData = action.payload;
    },
  },
});

export const { setUserdata } = userSlice.actions;
export default userSlice.reducer;
