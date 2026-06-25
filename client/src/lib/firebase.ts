import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue, child, update, push } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyC3XWO_Pf-YkYdxmPAbk9cfYuuPwVeq2BQ",
  authDomain: "mymsg-red.firebaseapp.com",
  databaseURL: "https://mymsg-red-default-rtdb.firebaseio.com",
  projectId: "mymsg-red",
  storageBucket: "mymsg-red.firebasestorage.app",
  messagingSenderId: "603255677298",
  appId: "1:603255677298:web:b129cef6240721b79d3deb",
  measurementId: "G-4Q35L2CPPV"
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
