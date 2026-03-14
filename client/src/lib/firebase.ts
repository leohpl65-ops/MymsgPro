import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue, child, update, push } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAzfoh8LHRqYM85ZCB_osh8gsARnBIysxs",
  authDomain: "mymsg-d786b.firebaseapp.com",
  databaseURL: "https://mymsg-d786b-default-rtdb.firebaseio.com",
  projectId: "mymsg-d786b",
  storageBucket: "mymsg-d786b.firebasestorage.app",
  messagingSenderId: "545434364942",
  appId: "1:545434364942:web:2801cd2df1b5925e0a605f",
  measurementId: "G-BE0RHRCHPG"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
