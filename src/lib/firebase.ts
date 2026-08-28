// Inicialización de Firebase (cliente). Config por variables de entorno.
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
// ignoreUndefinedProperties: red de seguridad. Sin esto, un solo campo opcional
// en `undefined` (ej. un producto sin código interno) hacía que Firestore
// RECHAZARA la escritura y la venta no se pudiera cerrar.
//
// localCache (IndexedDB, multi-pestaña): la clave para que el panel "ande rápido".
// Sin esto, CADA vez que se cambia de pestaña se re-suscribe a Firestore desde la
// red en frío y el área de contenido queda en blanco hasta que llega el primer
// snapshot (~150-300ms en datacenter, mucho más en la conexión real del cliente):
// eso es el "parpadeo/refresco" que se ve al navegar. Con caché persistente, al
// re-suscribir los onSnapshot entregan los datos AL INSTANTE desde IndexedDB y
// después el servidor confirma en segundo plano. persistentMultipleTabManager
// evita que dos pestañas del panel se peleen por el lock de IndexedDB.
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
export const storage = getStorage(app);
export const functions = getFunctions(app); // región default us-central1
export const googleProvider = new GoogleAuthProvider();

export default app;
