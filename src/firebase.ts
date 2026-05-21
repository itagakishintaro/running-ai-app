import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyDU1fRgT9_CbrWalsR6Jn8MHyR1aFF0GTI",
  authDomain: "running-ai-app-7e5ec.firebaseapp.com",
  projectId: "running-ai-app-7e5ec",
  storageBucket: "running-ai-app-7e5ec.firebasestorage.app",
  messagingSenderId: "858159460081",
  appId: "1:858159460081:web:e60b0f55ae40a40fb18350",
  measurementId: "G-Z871TS9KLZ",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "asia-northeast1");
export const googleProvider = new GoogleAuthProvider();
