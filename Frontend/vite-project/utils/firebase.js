// Firebase client SDK setup (handles the Google sign-in popup in the browser)
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "aryanai-1ffee.firebaseapp.com",
  projectId: "aryanai-1ffee",
  storageBucket: "aryanai-1ffee.firebasestorage.app",
  messagingSenderId: "775533651327",
  appId: "1:775533651327:web:5ce5107b96ace4297fe64a",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// `auth` manages sign-in state; `googleProvider` tells Firebase to use Google login
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
