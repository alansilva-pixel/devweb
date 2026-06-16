import { createContext, useContext, useEffect, useState, ReactNode } from "react";

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
const STORAGE_KEY = "sifu-submissions";

export const useSubmissions = () => {
  const ctx = useContext(SubmissionContext);
  if (!ctx) throw new Error("useSubmissions must be used within SubmissionProvider");
  return ctx;
};

export const SubmissionProvider = ({ children }: { children: ReactNode }) => {
  const [submissions, setSubmissions] = useState<Submission[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as Submission[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(submissions));
  }, [submissions]);

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
