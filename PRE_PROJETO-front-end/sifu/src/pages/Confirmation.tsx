import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import type { Submission } from "@/contexts/SubmissionContext";

const Confirmation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const sub = location.state as Submission | undefined;

  return (
    <div className="max-w-lg mx-auto mt-12">
      <Card className="shadow-sm">
        <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-4">
          <CheckCircle className="h-16 w-16 text-secondary" />
          <h1 className="text-xl font-bold text-primary">Pré-Projeto Enviado com Sucesso!</h1>

          {sub && (
            <div className="text-sm space-y-1 text-muted-foreground">
              <p><strong>Nome:</strong> {sub.nome}</p>
              <p><strong>Data:</strong> {sub.date}</p>
              <p><strong>Status:</strong> {sub.status}</p>
              <p><strong>Arquivo:</strong> {sub.fileName}</p>
            </div>
          )}

          <Button variant="default" onClick={() => navigate("/")} className="mt-4">
            Voltar ao Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Confirmation;
