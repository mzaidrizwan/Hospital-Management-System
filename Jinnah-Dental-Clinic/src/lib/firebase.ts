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



// Import the functions you need from the SDKs you need
// import { initializeApp } from "firebase/app";
// import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
// const firebaseConfig = {
//   apiKey: "AIzaSyDh1h9-28LRW_BzUHPhV5yCFVjtvP7_b2Y",
//   authDomain: "jinnah-dental.firebaseapp.com",
//   projectId: "jinnah-dental",
//   storageBucket: "jinnah-dental.firebasestorage.app",
//   messagingSenderId: "609695233734",
//   appId: "1:609695233734:web:5bf2bdfbbe384e9c4e89c7",
//   measurementId: "G-TL4BV0EVCS"
// };

// Initialize Firebase
// const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);