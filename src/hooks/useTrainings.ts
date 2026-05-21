import { useState, useEffect } from "react";
import {
  collection, query, orderBy, getDocs,
  addDoc, doc, updateDoc, deleteDoc, serverTimestamp, limit,
} from "firebase/firestore";
import { db } from "../firebase";
import { Training } from "../types";

export function useTrainings(uid: string | undefined) {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrainings = async () => {
    if (!uid) { setLoading(false); return; }
    const q = query(
      collection(db, "users", uid, "trainings"),
      orderBy("date", "desc"),
      limit(90)
    );
    const snap = await getDocs(q);
    setTrainings(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Training)));
    setLoading(false);
  };

  useEffect(() => { fetchTrainings(); }, [uid]);

  const addTraining = async (data: Omit<Training, "id" | "createdAt">) => {
    if (!uid) return;
    await addDoc(collection(db, "users", uid, "trainings"), {
      ...data,
      createdAt: serverTimestamp(),
    });
    await fetchTrainings();
  };

  const updateTraining = async (id: string, data: Partial<Training>) => {
    if (!uid) return;
    await updateDoc(doc(db, "users", uid, "trainings", id), data);
    await fetchTrainings();
  };

  const deleteTraining = async (id: string) => {
    if (!uid) return;
    await deleteDoc(doc(db, "users", uid, "trainings", id));
    await fetchTrainings();
  };

  return { trainings, loading, addTraining, updateTraining, deleteTraining, refetch: fetchTrainings };
}
