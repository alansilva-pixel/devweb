import { useNavigate } from "react-router-dom";
import { useSubmissions } from "@/contexts/SubmissionContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Send } from "lucide-react";

const statusColors: Record<string, string> = {
  "Não enviado": "bg-muted text-muted-foreground",
  "Em análise": "bg-yellow-100 text-yellow-800",
  "Aprovado": "bg-green-100 text-green-800",
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { latestStatus } = useSubmissions();
  const status = latestStatus();

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-primary">Dashboard</h1>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <FileText className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Status do TCC</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Situação atual:</span>
            <Badge className={statusColors[status] || "bg-muted"}>{status}</Badge>
          </div>
        </CardContent>
      </Card>

      <Button variant="action" size="lg" onClick={() => navigate("/enviar")} className="gap-2">
        <Send className="h-4 w-4" />
        Enviar Pré-Projeto de TCC
      </Button>
    </div>
  );
};

export default Dashboard;
