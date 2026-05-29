"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  signOut as fbSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";
import type { AppUser, Role } from "@/lib/types";

interface AuthState {
  fbUser: FirebaseUser | null;
  user: AppUser | null;
  loading: boolean;
  signInGoogle: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (name: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [fbUser, setFbUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fb) => {
      setFbUser(fb);
      if (!fb) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const ref = doc(db, "users", fb.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setUser(snap.data() as AppUser);
        } else {
          // Primer ingreso: SIEMPRE rol "cliente" (lo exigen las reglas
          // de Firestore). La promoción a superadmin/vendedor/socio se
          // hace desde la consola (la 1ra vez para Maxi) o por un
          // superadmin existente desde el panel de usuarios.
          const role: Role = "cliente";
          const newUser: AppUser = {
            uid: fb.uid,
            email: fb.email ?? "",
            displayName: fb.displayName ?? "Usuario",
            photoURL: fb.photoURL ?? undefined,
            role,
            createdAt: Date.now(),
          };
          await setDoc(ref, newUser);
          setUser(newUser);
        }
      } catch (e) {
        console.error("Error cargando usuario:", e);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const signInGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const signInEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  };

  // Auto-registro de clientes: crea la cuenta (Auth) + perfil rol "cliente".
  // Las reglas solo permiten autocrearse como cliente.
  const signUpEmail = async (name: string, email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );
    const displayName = name.trim() || "Cliente";
    await updateProfile(cred.user, { displayName });
    const newUser: AppUser = {
      uid: cred.user.uid,
      email: cred.user.email ?? email.trim(),
      displayName,
      role: "cliente",
      createdAt: Date.now(),
    };
    await setDoc(doc(db, "users", cred.user.uid), newUser, { merge: true });
    setUser(newUser);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  const signOut = async () => {
    await fbSignOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        fbUser,
        user,
        loading,
        signInGoogle,
        signInEmail,
        signUpEmail,
        resetPassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
