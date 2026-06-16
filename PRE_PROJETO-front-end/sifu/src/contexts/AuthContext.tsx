import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { fetchAuthSession, signInWithRedirect, signOut } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";

type User = {
  nome: string;
  matricula: string;
  email: string;
  fotoUrl?: string;
};

type AuthContextType = {
  user: User | null;
  login: () => Promise<void>;
  loginWithCredentials: (matricula: string, senha?: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function claimToString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const loadUser = async () => {
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken;

      if (!idToken) {
        setUser(null);
        return;
      }

      const payload = idToken.payload;
      const email = claimToString(payload.email);
      const nome = claimToString(payload.name) || claimToString(payload.given_name) || email || "Usuario";
      const fotoUrl = claimToString(payload.picture) || claimToString(payload.profile);

      setUser({
        nome,
        matricula: email,
        email,
        fotoUrl: fotoUrl || undefined,
      });
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    const unsubscribe = Hub.listen("auth", ({ payload }) => {
      switch (payload.event) {
        case "signInWithRedirect":
        case "signedIn":
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
      window.setTimeout(() => {
        void loadUser();
      }, 0);
    }

    return unsubscribe;
  }, []);

  const login = async () => {
    try {
      await signOut();
    } catch {
      // Ignora erro ao limpar uma sessao anterior.
    }
    await signInWithRedirect({ provider: "Google" });
  };

  const loginWithCredentials = (matricula: string) => {
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
