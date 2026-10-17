import { configureStore } from "@reduxjs/toolkit";
import useReducer from "./userSlice";

// Central Redux store. Each key in `reducer` becomes a slice of state:
// state.user -> handled by userSlice.js
export const store = configureStore({
  reducer: {
    user: useReducer,
  },
});
