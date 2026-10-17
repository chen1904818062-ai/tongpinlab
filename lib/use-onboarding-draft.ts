"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { allQuestions } from "@/lib/product-data";

type Draft = { profile: Record<string, string>; answers: Record<string, number>; savedAt: number };
const ids = new Set(allQuestions.map((question) => question.id));
export function useOnboardingDraft<T extends Record<string, string>>(userId: string, profile: T, setProfile: Dispatch<SetStateAction<T>>, answers: Record<string, number>, setAnswers: Dispatch<SetStateAction<Record<string, number>>>) {
  const key = `tongpin-onboarding-draft-v1:${userId}`;
  const [ready, setReady] = useState(false);
  const baselineProfile = useRef({ ...profile });
  const baselineAnswers = useRef({ ...answers });
  const read = useCallback((): Draft => {
    try {
      const stored = JSON.parse(localStorage.getItem(key) || "null") as Draft | null;
      if (stored && typeof stored.savedAt === "number" && stored.savedAt > Date.now() - 7 * 86400_000) return stored;
    } catch { /* invalid or disabled local storage */ }
    return { profile: {}, answers: {}, savedAt: Date.now() };
  }, [key]);
  const write = useCallback((draft: Draft) => { try { localStorage.setItem(key, JSON.stringify(draft)); } catch { /* server saves still work */ } }, [key]);
  useEffect(() => {
    const saved = read();
    const restoredAnswers = Object.fromEntries(Object.entries(saved.answers || {}).filter(([id, value]) => ids.has(id) && Number.isInteger(value) && value >= 1 && value <= 5));
    queueMicrotask(() => {
      setProfile((current) => {
        const next = { ...current };
        for (const field of Object.keys(current)) if (typeof saved.profile?.[field] === "string") (next as Record<string, string>)[field] = saved.profile[field].slice(0, 500);
        return next;
      });
      setAnswers((current) => ({ ...current, ...restoredAnswers }));
      setReady(true);
    });
  }, [read, setProfile, setAnswers]);
  useEffect(() => {
    if (!ready) return;
    write({
      profile: Object.fromEntries(Object.entries(profile).filter(([field, value]) => baselineProfile.current[field] !== value)),
      answers: Object.fromEntries(Object.entries(answers).filter(([id, value]) => baselineAnswers.current[id] !== value)),
      savedAt: Date.now(),
    });
  }, [profile, answers, ready, write]);
  const markProfileSaved = useCallback((saved: T) => {
    baselineProfile.current = { ...saved };
    const draft = read();
    for (const [field, value] of Object.entries(saved)) if (draft.profile?.[field] === value) delete draft.profile[field];
    write(draft);
  }, [read, write]);
  const markAnswersSaved = useCallback((saved: Record<string, number>) => {
    baselineAnswers.current = { ...baselineAnswers.current, ...saved };
    const draft = read();
    for (const [id, value] of Object.entries(saved)) if (draft.answers?.[id] === value) delete draft.answers[id];
    write(draft);
  }, [read, write]);
  return { ready, markProfileSaved, markAnswersSaved };
}
