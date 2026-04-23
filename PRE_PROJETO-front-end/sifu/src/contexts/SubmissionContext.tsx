import React, { createContext, useContext, useState, ReactNode } from "react";

export interface Submission {
  id: string;
  nome: string;
  date: string;
  status: "Não enviado" | "Em análise" | "Aprovado";
  fileName: string;
}

interface SubmissionContextType {
  submissions: Submission[];
  addSubmission: (sub: Omit<Submission, "id" | "date" | "status">) => Submission;
  latestStatus: () => string;
}

const SubmissionContext = createContext<SubmissionContextType | null>(null);

export const useSubmissions = () => {
  const ctx = useContext(SubmissionContext);
  if (!ctx) throw new Error("useSubmissions must be used within SubmissionProvider");
  return ctx;
};

export const SubmissionProvider = ({ children }: { children: ReactNode }) => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  const addSubmission = (sub: Omit<Submission, "id" | "date" | "status">) => {
    const newSub: Submission = {
      ...sub,
      id: crypto.randomUUID(),
      date: new Date().toLocaleDateString("pt-BR"),
      status: "Em análise",
    };
    setSubmissions((prev) => [newSub, ...prev]);
    return newSub;
  };

  const latestStatus = () => {
    if (submissions.length === 0) return "Não enviado";
    return submissions[0].status;
  };

  return (
    <SubmissionContext.Provider value={{ submissions, addSubmission, latestStatus }}>
      {children}
    </SubmissionContext.Provider>
  );
};