import { createContext, useContext, useState, ReactNode } from "react";

type User = {
  nome: string;
  matricula: string;
  email: string;
};

type AuthContextType = {
  user: User | null;
  login: (matricula: string, senha?: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = (matricula: string, _senha?: string) => {
    setUser({
      nome: "Aluno Teste",
      matricula,
      email: `${matricula}@alunos.ufersa.edu.br`
    });
  };
  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return context;
}