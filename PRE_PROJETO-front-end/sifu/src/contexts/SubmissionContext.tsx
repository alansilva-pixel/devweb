import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";

export interface Submission {
  id: string;
  nome: string;
  date: string;
  status: "Nao enviado" | "Em analise" | "Aprovado";
  fileName: string;
  backendSubmissionId?: string;
  createdAt?: string;
  processingStatus?: string;
}

interface SubmissionContextType {
  submissions: Submission[];
  addSubmission: (sub: Omit<Submission, "id" | "date" | "status">) => Submission;
  latestStatus: () => string;
}

const SubmissionContext = createContext<SubmissionContextType | null>(null);
const LEGACY_STORAGE_KEY = "sifu-submissions";
const STORAGE_KEY_PREFIX = "sifu-submissions:";

function getStorageKey(userId?: string) {
  return `${STORAGE_KEY_PREFIX}${userId || "anonymous"}`;
}

function readSubmissions(storageKey: string) {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    const stored = localStorage.getItem(storageKey);
    const parsed = stored ? (JSON.parse(stored) as Submission[]) : [];
    return parsed.filter((submission) => Boolean(submission.backendSubmissionId));
  } catch {
    return [];
  }
}

export const useSubmissions = () => {
  const ctx = useContext(SubmissionContext);
  if (!ctx) throw new Error("useSubmissions must be used within SubmissionProvider");
  return ctx;
};

export const SubmissionProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const storageKey = getStorageKey(user?.id || user?.email);
  const [submissions, setSubmissions] = useState<Submission[]>(() => readSubmissions(storageKey));

  useEffect(() => {
    setSubmissions(readSubmissions(storageKey));
  }, [storageKey]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(submissions));
  }, [storageKey, submissions]);

  const addSubmission = (sub: Omit<Submission, "id" | "date" | "status">) => {
    const newSub: Submission = {
      ...sub,
      id: crypto.randomUUID(),
      date: new Date().toLocaleDateString("pt-BR"),
      status: "Em analise",
    };
    setSubmissions((prev) => [newSub, ...prev]);
    return newSub;
  };

  const latestStatus = () => {
    if (submissions.length === 0) return "Nao enviado";
    return submissions[0].status;
  };

  return (
    <SubmissionContext.Provider value={{ submissions, addSubmission, latestStatus }}>
      {children}
    </SubmissionContext.Provider>
  );
};
