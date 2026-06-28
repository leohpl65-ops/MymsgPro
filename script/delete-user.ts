import { db } from "../client/src/lib/firebase";
import { ref, get, remove } from "firebase/database";

async function run() {
  const usersRef = ref(db, 'users');
  const snap = await get(usersRef);
  if (snap.exists()) {
    const users = snap.val();
    for (const uid in users) {
      const u = users[uid];
      if (u && (u.originalName === 'theowner' || u.name === 'theowner')) {
        console.log("Deleting user:", uid, u);
        await remove(ref(db, `users/${uid}`));
      }
    }
  }
  console.log("Done");
  process.exit(0);
}
run();
