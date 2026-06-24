import { useState, useEffect, useCallback } from "react";
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  getDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { Goal, GoalInput } from "../types";

export function useGoals(uid: string | undefined) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGoals = useCallback(async () => {
    if (!uid) {
      setGoals([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const q = query(
        collection(db, "users", uid, "goals"),
        orderBy("targetDate", "asc")
      );
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          marathonType: data.marathonType,
          currentTimeSec: data.currentTimeSec,
          targetTimeSec: data.targetTimeSec,
          targetDate: data.targetDate,
          updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
        } as Goal;
      });
      setGoals(items);
    } catch (e) {
      setError("目標の読み込みに失敗しました");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  const migrateLegacyGoal = useCallback(async () => {
    if (!uid) return;
    setMigrating(true);
    try {
      const legacyRef = doc(db, "users", uid, "data", "goal");
      const legacySnap = await getDoc(legacyRef);
      if (!legacySnap.exists()) return;

      const goalsSnap = await getDocs(collection(db, "users", uid, "goals"));
      if (!goalsSnap.empty) return;

      const data = legacySnap.data();
      const newGoalRef = doc(collection(db, "users", uid, "goals"));

      const batch = writeBatch(db);
      batch.set(newGoalRef, {
        marathonType: data.marathonType,
        currentTimeSec: data.currentTimeSec,
        targetTimeSec: data.targetTimeSec,
        targetDate: data.targetDate,
        updatedAt: serverTimestamp(),
      });
      batch.delete(legacyRef);
      await batch.commit();
    } catch (e) {
      setError("既存の目標データ移行に失敗しました。目標を再登録してください。");
      console.error(e);
    } finally {
      setMigrating(false);
    }
  }, [uid]);

  useEffect(() => {
    const run = async () => {
      if (!uid) {
        setLoading(false);
        return;
      }
      await migrateLegacyGoal();
      await fetchGoals();
    };
    run();
  }, [uid, migrateLegacyGoal, fetchGoals]);

  const addGoal = async (data: GoalInput) => {
    if (!uid) return;
    await addDoc(collection(db, "users", uid, "goals"), {
      ...data,
      updatedAt: serverTimestamp(),
    });
    await fetchGoals();
  };

  const updateGoal = async (id: string, data: GoalInput) => {
    if (!uid) return;
    await updateDoc(doc(db, "users", uid, "goals", id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
    await fetchGoals();
  };

  const deleteGoal = async (id: string) => {
    if (!uid) return;
    await deleteDoc(doc(db, "users", uid, "goals", id));
    await fetchGoals();
  };

  return {
    goals,
    loading,
    migrating,
    error,
    addGoal,
    updateGoal,
    deleteGoal,
    refetch: fetchGoals,
  };
}
