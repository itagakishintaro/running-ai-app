import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { UserProfile } from "../types";

export function useProfile(uid: string | undefined) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    getDoc(doc(db, "users", uid, "data", "profile")).then((snap) => {
      if (snap.exists()) setProfile(snap.data() as UserProfile);
      setLoading(false);
    });
  }, [uid]);

  const saveProfile = async (data: Omit<UserProfile, "updatedAt">) => {
    if (!uid) return;
    const payload = { ...data, updatedAt: serverTimestamp() };
    await setDoc(doc(db, "users", uid, "data", "profile"), payload);
    setProfile({ ...data, updatedAt: new Date() });
  };

  return { profile, loading, saveProfile };
}
