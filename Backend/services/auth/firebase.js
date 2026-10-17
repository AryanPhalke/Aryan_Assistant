import { initializeApp, cert } from "firebase-admin/app";
// Private key file downloaded from the Firebase console. Never commit it to git.
import serviceAccount from "./serviceAccountKey.json" with { type: "json" };

// Firebase Admin SDK: lets our server verify the ID tokens that the frontend
// gets after a user signs in with Google.
export const app = initializeApp({
  credential: cert(serviceAccount),
});
