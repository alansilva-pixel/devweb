import { useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useSubmissions } from "@/contexts/SubmissionContext";

const API_URL =
  import.meta.env.VITE_CHATBOT_API_URL ||
  "https://api.alanalmeida.sifu5.web.ufersa.dev.br/chatbot";

type Message = {
  from: "user" | "bot";
  text: string;
};

const Chatbot = () => {
  const { user } = useAuth();
  const { submissions, latestStatus } = useSubmissions();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    const userMsg = input.trim();
    if (!userMsg) return;

    setMessages((prev) => [...prev, { from: "user", text: userMsg }]);
    setInput("");
    setLoading(true);

    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      if (!token) {
        throw new Error("Usuário sem token de autenticação.");
      }

      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: userMsg,
          context: {
            interactionSource: "chatbot-web",
            user,
            submissionSummary: {
              latestStatus: latestStatus(),
              totalSubmissions: submissions.length,
              lastSubmission: submissions[0] || null,
            },
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Erro ao consultar a IA.");
      }

      setMessages((prev) => [...prev, { from: "bot", text: data.message }]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro ao conectar.";
      setMessages((prev) => [...prev, { from: "bot", text: errorMessage }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open ? (
        <div className="flex w-80 flex-col overflow-hidden rounded-lg border bg-white shadow-xl">
          <div className="flex items-center justify-between bg-primary px-4 py-3 text-white">
            <span className="font-semibold">Assistente SIFU</span>
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

          <div className="h-64 flex-1 space-y-2 overflow-y-auto p-3">
            {messages.map((msg, index) => (
              <div
                key={`${msg.from}-${index}`}
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.from === "user" ? "ml-auto bg-primary text-white" : "bg-gray-100 text-gray-800"
                }`}
              >
                {msg.text}
              </div>
            ))}
            {loading && <div className="text-sm text-gray-400">Digitando...</div>}
          </div>

          <div className="flex gap-2 border-t p-2">
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && sendMessage()}
              placeholder="Digite uma mensagem..."
              className="text-sm"
            />
            <Button size="sm" onClick={sendMessage} disabled={loading}>
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
