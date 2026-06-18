import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { fetchAuthSession, signInWithRedirect, signOut } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";

type User = {
  id: string;
  nome: string;
  matricula: string;
  email: string;
  fotoUrl?: string;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: () => Promise<void>;
  loginWithCredentials: (matricula: string, senha?: string) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const cognitoDomain = "https://us-east-180jtnciqe.auth.us-east-1.amazoncognito.com";
const profileApiUrl = import.meta.env.VITE_PROFILE_API_URL as string | undefined;
const LOGIN_NONCE_KEY = "sifu-login-nonce";

function claimToString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function createNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isValidTokenPayload(payload: Record<string, unknown>) {
  const expiresAt = Number(payload.exp || 0) * 1000;
  return Boolean(payload.sub) && Boolean(payload["cognito:username"]) && expiresAt > Date.now();
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

async function fetchStoredProfile(token?: string) {
  if (!profileApiUrl || !token) return null;

  try {
    const response = await fetch(profileApiUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.profile as { nome?: string; matricula?: string; photoUrl?: string };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = async () => {
    try {
      setIsLoading(true);
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
      const expectedNonce = sessionStorage.getItem(LOGIN_NONCE_KEY);

      if (!isValidTokenPayload(payload)) {
        throw new Error("Token de login invalido ou expirado.");
      }

      if (expectedNonce && claimToString(payload.nonce) !== expectedNonce) {
        await signOut().catch(() => {});
        sessionStorage.removeItem(LOGIN_NONCE_KEY);
        throw new Error("Token de login nao corresponde a tentativa atual.");
      }

      if (expectedNonce) {
        sessionStorage.removeItem(LOGIN_NONCE_KEY);
      }

      const userInfo = await fetchUserInfo(session.tokens?.accessToken?.toString());
      const email =
        claimToString(userInfo.email) ||
        claimToString(payload.email);
      const username =
        claimToString(payload["cognito:username"]) ||
        claimToString(userInfo.username) ||
        claimToString(payload.username) ||
        claimToString(payload.sub);
      const userId = claimToString(payload.sub) || username || email;
      const nome =
        claimToString(userInfo.name) ||
        claimToString(payload.name) ||
        claimToString(userInfo.given_name) ||
        claimToString(payload.given_name) ||
        getFallbackName(email, username);
      const fotoUrl =
        claimToString(userInfo.picture) ||
        claimToString(payload.picture) ||
        claimToString(userInfo.profile) ||
        claimToString(payload.profile);
      const storedProfile = await fetchStoredProfile(idToken.toString());

      setUser({
        id: userId,
        nome: claimToString(storedProfile?.nome) || nome,
        matricula: claimToString(storedProfile?.matricula) || email || username,
        email,
        fotoUrl: claimToString(storedProfile?.photoUrl) || fotoUrl || undefined,
      });
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
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
    const nonce = createNonce();
    sessionStorage.setItem(LOGIN_NONCE_KEY, nonce);

    try {
      await signOut({ global: true });
    } catch {
      // Ignora erro ao limpar uma sessao anterior.
    }
    await signInWithRedirect({
      provider: "Google",
      options: {
        prompt: "SELECT_ACCOUNT",
        nonce,
        lang: "pt-BR",
      },
    });
  };

  const loginWithCredentials = (matricula: string) => {
    console.warn("Login local bloqueado. Use o login com Google para gerar token Cognito.", matricula);
  };

  const logout = async () => {
    setUser(null);
    setIsLoading(true);
    sessionStorage.removeItem(LOGIN_NONCE_KEY);

    try {
      await signOut({ global: true });
    } catch {
      // Mantem o usuario deslogado localmente mesmo se o Cognito falhar.
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, loginWithCredentials, logout, refreshUser: loadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return context;
}
