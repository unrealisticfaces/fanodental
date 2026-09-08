// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

// Export the config so Settings.jsx can use it to create secondary accounts
export const firebaseConfig = {
  apiKey: "AIzaSyC_4IWNQ4c6-tw2Db_e4iSfALeQQJU97XY",
  authDomain: "fanolab.firebaseapp.com",
  databaseURL: "https://fanolab-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "fanolab",
  storageBucket: "fanolab.firebasestorage.app",
  messagingSenderId: "64382584911",
  appId: "1:64382584911:web:5850ac73477e36ca3a823a",
  measurementId: "G-PY9ZQGDNWC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);

// Export Auth and Database so the rest of the application can use them
export const auth = getAuth(app);
export const database = getDatabase(app);