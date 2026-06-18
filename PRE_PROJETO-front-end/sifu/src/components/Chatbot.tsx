import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { MessageCircle, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";

const API_URL =
  import.meta.env.VITE_CHATBOT_API_URL ||
  "https://fecslb5103.execute-api.us-east-1.amazonaws.com/Prod/chatbot";

type Message = {
  from: "user" | "bot";
  text: string;
};

const suggestions = ["Resuma meu pré-projeto", "Analise a metodologia", "Qual é o status da minha submissão?"];

const welcomeMessage: Message = {
  from: "bot",
  text: "Olá! Posso consultar sua submissão e analisar o pré-projeto enviado. O que você gostaria de verificar?",
};

const Chatbot = () => {
  const { user } = useAuth();
  const storageSuffix = user?.id || user?.email || "anonymous";
  const messagesKey = `sifu-chat-messages:${storageSuffix}`;
  const conversationKey = `sifu-chat-conversation:${storageSuffix}`;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const stored = localStorage.getItem(messagesKey);
      return stored ? (JSON.parse(stored) as Message[]) : [welcomeMessage];
    } catch {
      return [welcomeMessage];
    }
  });
  const [conversationId, setConversationId] = useState(
    () => localStorage.getItem(conversationKey) || crypto.randomUUID(),
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem(messagesKey, JSON.stringify(messages.slice(-30)));
  }, [messages, messagesKey]);

  useEffect(() => {
    localStorage.setItem(conversationKey, conversationId);
  }, [conversationId, conversationKey]);

  const clearConversation = () => {
    const nextConversationId = crypto.randomUUID();
    setMessages([welcomeMessage]);
    setConversationId(nextConversationId);
    localStorage.removeItem(messagesKey);
    localStorage.setItem(conversationKey, nextConversationId);
  };

  const sendMessage = async (suggestedMessage?: string) => {
    const userMsg = (suggestedMessage || input).trim();
    if (!userMsg || loading) return;

    setMessages((previous) => [...previous, { from: "user", text: userMsg }]);
    setInput("");
    setLoading(true);

    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString() || session.tokens?.accessToken?.toString();

      if (!token) {
        throw new Error("Usuário sem token de autenticação.");
      }

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: userMsg,
          conversationId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erro ao consultar a IA.");
      }

      if (typeof data.conversationId === "string") {
        setConversationId(data.conversationId);
      }
      setMessages((previous) => [...previous, { from: "bot", text: data.message }]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro ao conectar.";
      setMessages((previous) => [...previous, { from: "bot", text: errorMessage }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
      {open ? (
        <div className="flex max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-lg border bg-white shadow-xl sm:max-h-[calc(100vh-3rem)]">
          <div className="flex items-center justify-between bg-primary px-4 py-3 text-white">
            <span className="font-semibold">Assistente SIFU</span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={clearConversation}
                className="h-8 w-8 text-white hover:bg-primary/80"
                aria-label="Limpar conversa"
                title="Nova conversa"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                className="h-8 w-8 text-white hover:bg-primary/80"
                aria-label="Fechar chat"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden p-3 sm:max-h-[60vh]">
            {messages.map((message, index) => (
              <div
                key={`${message.from}-${index}`}
                className={`max-w-[85%] overflow-hidden whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm leading-relaxed ${
                  message.from === "user" ? "ml-auto bg-primary text-white" : "bg-gray-100 text-gray-800"
                }`}
              >
                {message.text}
              </div>
            ))}

            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void sendMessage(suggestion)}
                    disabled={loading}
                    className="rounded-full border border-primary/30 px-3 py-1.5 text-left text-xs text-primary transition-colors hover:bg-primary/5 disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {loading && <div className="text-sm text-gray-400">Consultando seus dados...</div>}
          </div>

          <div className="flex min-w-0 gap-2 border-t p-2">
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                  void sendMessage();
                }
              }}
              placeholder="Digite uma mensagem..."
              className="min-w-0 text-sm"
              maxLength={4000}
            />
            <Button size="sm" onClick={() => void sendMessage()} disabled={loading}>
              Enviar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          onClick={() => setOpen(true)}
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg"
          aria-label="Abrir chat"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}
    </div>
  );
};

export default Chatbot;
