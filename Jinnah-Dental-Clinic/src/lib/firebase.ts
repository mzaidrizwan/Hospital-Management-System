import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:"AIzaSyDh1h9-28LRW_BzUHPhV5yCFVjtvP7_b2Y",
  authDomain: "jinnah-dental.firebaseapp.com",
  projectId: "jinnah-dental",
  storageBucket: "jinnah-dental.firebasestorage.app",
  messagingSenderId: "609695233734",
  appId: "1:609695233734:web:5bf2bdfbbe384e9c4e89c7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);