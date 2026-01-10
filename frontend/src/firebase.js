// Paste your Firebase config values below
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // NEW

const firebaseConfig = {
  apiKey: "AIzaSyCpmB7Y9aW3fz5Qg4zy2qrRu33dOf-J5tg",
  authDomain: "mock-interview-5259f.firebaseapp.com",
  projectId: "mock-interview-5259f",
  storageBucket: "mock-interview-5259f.firebasestorage.app",
  messagingSenderId: "797338571724",
  appId: "1:797338571724:web:14f8d2798062f264168369"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app); // NEW
