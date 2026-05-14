import { useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API_URL = "https://fecslb5103.execute-api.us-east-1.amazonaws.com/prod/chatbot";

type Message = {
  from: "user" | "bot";
  text: string;
};

const Chatbot = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setMessages((prev) => [...prev, { from: "user", text: userMsg }]);
    setInput("");
    setLoading(true);

    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      
      console.log("Token enviado:", token?.substring(0, 20) + "..."); // debug

      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ message: userMsg }),
      });

      const data = await res.json();
      setMessages((prev) => [...prev, { from: "bot", text: data.message }]);
    } catch {
      setMessages((prev) => [...prev, { from: "bot", text: "Erro ao conectar." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open ? (
        <div className="w-80 bg-white border rounded-xl shadow-xl flex flex-col overflow-hidden">
          <div className="bg-primary text-white px-4 py-3 flex justify-between items-center">
            <span className="font-semibold">Assistente SIFU</span>
            <button onClick={() => setOpen(false)} className="text-white text-lg">✕</button>
          </div>
          <div className="flex-1 p-3 space-y-2 h-64 overflow-y-auto">
            {messages.map((msg, i) => (
              <div key={i} className={`text-sm px-3 py-2 rounded-lg max-w-[85%] ${msg.from === "user" ? "bg-primary text-white ml-auto" : "bg-gray-100 text-gray-800"}`}>
                {msg.text}
              </div>
            ))}
            {loading && <div className="text-sm text-gray-400">Digitando...</div>}
          </div>
          <div className="p-2 border-t flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Digite uma mensagem..."
              className="text-sm"
            />
            <Button size="sm" onClick={sendMessage}>Enviar</Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => setOpen(true)} className="rounded-full w-14 h-14 text-2xl shadow-lg">
          💬
        </Button>
      )}
    </div>
  );
};

export default Chatbot;