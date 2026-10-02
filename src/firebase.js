// firebase.js — Configuration de Firebase pour Iphax

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Configuration Firebase (depuis la console Firebase)
const firebaseConfig = {
  apiKey: 'AIzaSyCwE5cumxgs8vB_6ZZM49-5qZ1hy0k5pLA',
  authDomain: 'iphax-ac57b.firebaseapp.com',
  projectId: 'iphax-ac57b',
  storageBucket: 'iphax-ac57b.firebasestorage.app',
  messagingSenderId: '598455617044',
  appId: '1:598455617044:web:1ef068dd645bd4311f0901',
  measurementId: 'G-879QGVZ0QH',
};

// Initialisation
const app = initializeApp(firebaseConfig);

// Services qu'on utilisera
export const auth = getAuth(app); // Pour l'authentification
export const db = getFirestore(app); // Pour la base de données
export default app;
