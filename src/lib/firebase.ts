import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAvy0JL29OoCL50XxMXs0Q_j7TItROoi08",
  authDomain: "tmr-scraper-db.firebaseapp.com",
  projectId: "tmr-scraper-db",
  storageBucket: "tmr-scraper-db.firebasestorage.app",
  messagingSenderId: "395646539727",
  appId: "1:395646539727:web:92c895ebdd1101f996e4ba"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
