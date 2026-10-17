import axios from "axios";

// Pre-configured axios instance used for all backend calls.
// baseURL: the gateway address (VITE_SERVER_URL in .env)
// withCredentials: makes the browser send the session cookie with each request
const api = axios.create({
  baseURL: import.meta.env.VITE_SERVER_URL,
  withCredentials: true,
});

export default api;
