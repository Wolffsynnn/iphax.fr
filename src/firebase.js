// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCwE5cumxgs8yB_6ZZM49-5qZ1hy0k5plA",
  authDomain: "iphax-ac57b.firebaseapp.com",
  projectId: "iphax-ac57b",
  storageBucket: "iphax-ac57b.firebasestorage.app",
  messagingSenderId: "598455617044",
  appId: "1:598455617044:web:1ef068dd645bd4311f0901",
  measurementId: "G-879QGVZ0QH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);