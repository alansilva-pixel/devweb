import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { signInWithRedirect, signOut } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { fetchAuthSession } from "aws-amplify/auth";  

type User = {
  nome: string;
  matricula: string;
  email: string;
};

type AuthContextType = {
  user: User | null;
  login: () => Promise<void>;
  loginWithCredentials: (matricula: string, senha?: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

    // Decodifica o JWT sem chamada extra ao Cognito
    const payload = idToken.payload;
    setUser({
      nome: String(payload["name"] || payload["email"] || "Usuário"),
      matricula: String(payload["email"] || ""),
      email: String(payload["email"] || ""),
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
        case "signedIn":          // ← adicione essa linha
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

  const login = async () => {
    try {
      await signOut();
    } catch {
      // ignora erro
    }
    await signInWithRedirect({ provider: "Google" });
  };

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