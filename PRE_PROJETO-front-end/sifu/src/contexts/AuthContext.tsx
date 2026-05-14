import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { signInWithRedirect, signOut, getCurrentUser, fetchUserAttributes } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";

type User = {
  nome: string;
  matricula: string;
  email: string;
};

type AuthContextType = {
  user: User | null;
  login: () => void;
  loginWithCredentials: (matricula: string, senha?: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const loadUser = async () => {
    try {
      await getCurrentUser();
      const attrs = await fetchUserAttributes();
      setUser({
        nome: attrs.name || attrs.email || "Usuário",
        matricula: attrs.email || "",
        email: attrs.email || "",
      });
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    const unsubscribe = Hub.listen("auth", ({ payload }) => {
      console.log("Hub event:", payload.event);
      switch (payload.event) {
        case "signInWithRedirect":
          loadUser();
          break;
        case "signInWithRedirect_failure":
          console.error("Erro no login com Google:", payload.data);
          setUser(null);
          break;
        case "signedOut":
          setUser(null);
          break;
      }
    });

    const urlParams = new URLSearchParams(window.location.search);
    const hasCode = urlParams.has("code");

    if (!hasCode) {
      loadUser();
    }

    return unsubscribe;
  }, []);

  const login = () => signInWithRedirect({ provider: "Google" });

  const loginWithCredentials = (matricula: string, _senha?: string) => {
    setUser({
      nome: "Aluno Teste",
      matricula,
      email: `${matricula}@alunos.ufersa.edu.br`,
    });
  };

  const logout = () => {
    signOut().catch(() => {});
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, loginWithCredentials, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return context;
}