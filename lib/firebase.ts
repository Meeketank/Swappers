import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDQlbO_L9tMEIwhmfRlXpqacY96fuMK9wQ",
  authDomain: "swappapp-oodo.firebaseapp.com",
  projectId: "swappapp-oodo",
  messagingSenderId: "370171440521",
  appId: "1:370171440521:web:bb2eb63fc79d3f7fa1c558"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code == 'failed-precondition') {
    console.log("Offline persistence can only be enabled in one tab at a time.");
  } else if (err.code == 'unimplemented') {
    console.log("The current browser does not support offline persistence.");
  }
});