import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubmissions } from "@/contexts/SubmissionContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, Upload } from "lucide-react";

const SubmitProject = () => {
  const { user } = useAuth();
  const { addSubmission } = useSubmissions();
  const navigate = useNavigate();

  const [orientador, setOrientador] = useState("");
  const [emailOrientador, setEmailOrientador] = useState("");
  const [coorientador, setCoorientador] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !confirmed) return;

    const sub = addSubmission({
      nome: user?.nome || "",
      fileName: file.name,
    });

    navigate("/confirmacao", { state: sub });
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-primary">Enviar Pré-Projeto de TCC</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Dados do Aluno</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={user?.nome || ""} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Matrícula</Label>
                <Input value={user?.matricula || ""} readOnly className="bg-muted" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email institucional</Label>
              <Input value={user?.email || ""} readOnly className="bg-muted" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Dados do Orientador</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do orientador</Label>
                <Input value={orientador} onChange={(e) => setOrientador(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Email do orientador</Label>
                <Input type="email" value={emailOrientador} onChange={(e) => setEmailOrientador(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Coorientador (opcional)</Label>
              <Input value={coorientador} onChange={(e) => setCoorientador(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200">
          <AlertCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-primary">
            Envie um único arquivo PDF contendo todos os documentos assinados. Tamanho máximo: 10MB.
          </p>
        </div>

        <Card className="shadow-sm">
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label>Arquivo PDF</Label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-4 py-2 border border-input rounded-md cursor-pointer hover:bg-muted transition-colors text-sm">
                  <Upload className="h-4 w-4" />
                  Selecionar arquivo
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </label>
                {file && <span className="text-sm text-muted-foreground">{file.name}</span>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="confirm"
                checked={confirmed}
                onCheckedChange={(v) => setConfirmed(v === true)}
              />
              <label htmlFor="confirm" className="text-sm">
                Confirmo que todas as informações estão corretas e o documento está assinado.
              </label>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" variant="action" size="lg" disabled={!file || !confirmed} className="gap-2">
          Enviar Pré-Projeto
        </Button>
      </form>
    </div>
  );
};

export default SubmitProject;
