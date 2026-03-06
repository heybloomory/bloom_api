import admin from "firebase-admin";
import fs from "fs";

let firebaseApp = null;

export function getFirebaseAdmin() {
  if (firebaseApp) return admin;

  const p = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!p) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_PATH in .env");

  const serviceAccount = JSON.parse(fs.readFileSync(p, "utf8"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  firebaseApp = admin;
  return admin;
}
