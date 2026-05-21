import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { Goal } from "../types";

export function useGoal(uid: string | undefined) {
  const [goal, setGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    getDoc(doc(db, "users", uid, "data", "goal")).then((snap) => {
      if (snap.exists()) setGoal(snap.data() as Goal);
      setLoading(false);
    });
  }, [uid]);

  const saveGoal = async (data: Omit<Goal, "updatedAt">) => {
    if (!uid) return;
    const payload = { ...data, updatedAt: serverTimestamp() };
    await setDoc(doc(db, "users", uid, "data", "goal"), payload);
    setGoal({ ...data, updatedAt: new Date() });
  };

  return { goal, loading, saveGoal };
}
