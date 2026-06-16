import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { fetchAuthSession, fetchUserAttributes, signInWithRedirect, signOut } from "aws-amplify/auth";
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
const cognitoDomain = "https://us-east-180jtnciqe.auth.us-east-1.amazoncognito.com";

function claimToString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function fetchUserInfo(accessToken?: string) {
  if (!accessToken) return {};

  try {
    const response = await fetch(`${cognitoDomain}/oauth2/userInfo`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) return {};

    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function getFallbackName(email: string, username: string) {
  if (email) return email.split("@")[0];
  return username.startsWith("google_") ? "Usuario Google" : username || "Usuario";
}

async function getCognitoAttributes() {
  try {
    return (await fetchUserAttributes()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const loadUser = async () => {
    try {
      let session = await fetchAuthSession();
      let idToken = session.tokens?.idToken;

      for (let attempt = 0; !idToken && attempt < 5; attempt += 1) {
        await wait(300);
        session = await fetchAuthSession();
        idToken = session.tokens?.idToken;
      }

      if (!idToken) {
        setUser(null);
        return;
      }

      const payload = idToken.payload;
      const attributes = await getCognitoAttributes();
      const userInfo = await fetchUserInfo(session.tokens?.accessToken?.toString());
      const email =
        claimToString(attributes.email) ||
        claimToString(userInfo.email) ||
        claimToString(payload.email);
      const username =
        claimToString(payload["cognito:username"]) ||
        claimToString(attributes.preferred_username) ||
        claimToString(userInfo.username) ||
        claimToString(payload.username) ||
        claimToString(payload.sub);
      const nome =
        claimToString(attributes.name) ||
        claimToString(userInfo.name) ||
        claimToString(payload.name) ||
        claimToString(attributes.given_name) ||
        claimToString(userInfo.given_name) ||
        claimToString(payload.given_name) ||
        getFallbackName(email, username);
      const fotoUrl =
        claimToString(attributes.picture) ||
        claimToString(userInfo.picture) ||
        claimToString(payload.picture) ||
        claimToString(userInfo.profile) ||
        claimToString(payload.profile);

      setUser({
        nome,
        matricula: email || username,
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

    window.setTimeout(() => {
      void loadUser();
    }, 0);

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
