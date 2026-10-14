// Import the functions you need from the SDKs you need
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

export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
