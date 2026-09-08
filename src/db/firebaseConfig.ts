import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

// Reemplace estos valores con las credenciales de su consola de Firebase
// (Consola Firebase -> Configuración del Proyecto -> General -> Sus aplicaciones)
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_AUTH_DOMAIN_HERE",
  projectId: "YOUR_PROJECT_ID_HERE",
  storageBucket: "YOUR_STORAGE_BUCKET_HERE",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID_HERE",
  appId: "YOUR_APP_ID_HERE"
};

// Verificar si las credenciales han sido ingresadas por el usuario
const isConfigured = 
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== "YOUR_API_KEY_HERE" &&
  !firebaseConfig.apiKey.includes("YOUR_");

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let isFirebaseAvailable = false;

if (isConfigured) {
  try {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }
    db = getFirestore(app);
    auth = getAuth(app);
    isFirebaseAvailable = true;
    console.log("🔥 Firebase inicializado con éxito.");
  } catch (error) {
    console.error("⚠️ Error al inicializar Firebase. Usando base de datos local temporal.", error);
    isFirebaseAvailable = false;
  }
} else {
  console.log("ℹ️ Firebase no configurado aún (usando placeholders). El sistema operará en Modo Local (LocalStorage) de alta fidelidad para previsualización.");
}

export { app, db, auth, isFirebaseAvailable };
