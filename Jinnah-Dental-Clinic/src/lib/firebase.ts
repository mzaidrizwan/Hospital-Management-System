import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from 'firebase/auth';

// const firebaseConfig = {
//   apiKey:"AIzaSyDh1h9-28LRW_BzUHPhV5yCFVjtvP7_b2Y",
//   authDomain: "jinnah-dental.firebaseapp.com",
//   projectId: "jinnah-dental",
//   storageBucket: "jinnah-dental.firebasestorage.app",
//   messagingSenderId: "609695233734",
//   appId: "1:609695233734:web:5bf2bdfbbe384e9c4e89c7"
// };

const firebaseConfig = {
  apiKey: "AIzaSyBdm9Gji2Q77vB1wICvYJ6FnwfBvi9DIBw",
  authDomain: "testing-priject-a569a.firebaseapp.com",
  projectId: "testing-priject-a569a",
  storageBucket: "testing-priject-a569a.firebasestorage.app",
  messagingSenderId: "681247950958",
  appId: "1:681247950958:web:0d3e776be68471480e3e7f",
  measurementId: "G-N8CCBV79DJ"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);