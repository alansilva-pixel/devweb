import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAuthSession } from "aws-amplify/auth";
import { useAuth } from "@/contexts/AuthContext";
import { useSubmissions } from "@/contexts/SubmissionContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, Upload } from "lucide-react";

const SUBMISSIONS_API_URL =
  import.meta.env.VITE_SUBMISSIONS_API_URL ||
  "https://04v1gt1t9a.execute-api.us-east-1.amazonaws.com/Prod/submissions";

const SubmitProject = () => {
  const { user } = useAuth();
  const { addSubmission } = useSubmissions();
  const navigate = useNavigate();

  const [orientador, setOrientador] = useState("");
  const [emailOrientador, setEmailOrientador] = useState("");
  const [coorientador, setCoorientador] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !confirmed || isSubmitting) return;

    setError("");
    setIsSubmitting(true);

    let currentStep = "autenticação";

    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString() || session.tokens?.accessToken?.toString();

      if (!token) {
        throw new Error("Usuario sem token de autenticacao.");
      }

      currentStep = "criação da submissão";
      const createResponse = await fetch(SUBMISSIONS_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || "application/pdf",
          fileSize: file.size,
          orientador,
          emailOrientador,
          coorientador,
          user: {
            nome: user?.nome || "",
            email: user?.email || "",
            matricula: user?.matricula || "",
          },
        }),
      });

      const createData = await createResponse.json();

      if (!createResponse.ok) {
        throw new Error(createData.message || "Nao foi possivel iniciar o envio.");
      }

      currentStep = "upload do PDF";
      const uploadResponse = await fetch(createData.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/pdf",
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Nao foi possivel enviar o PDF para o S3 (HTTP ${uploadResponse.status}).`);
      }

      currentStep = "confirmação do envio";
      const completeResponse = await fetch(`${SUBMISSIONS_API_URL}/${createData.submissionId}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          createdAt: createData.createdAt,
        }),
      });

      const completeData = await completeResponse.json();

      if (!completeResponse.ok) {
        throw new Error(completeData.message || "Nao foi possivel enfileirar o processamento do PDF.");
      }

      const sub = addSubmission({
        nome: user?.nome || "",
        fileName: file.name,
        backendSubmissionId: createData.submissionId,
        createdAt: createData.createdAt,
        processingStatus: completeData.processingStatus,
      });

      navigate("/confirmacao", { state: sub });
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Erro desconhecido.";
      setError(`Falha na etapa de ${currentStep}: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-primary">Enviar Pre-Projeto de TCC</h1>

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
                <Label>Matricula</Label>
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

        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm text-primary">
            Envie um unico arquivo PDF contendo todos os documentos assinados. Tamanho maximo: 10MB. A IA processara o
            arquivo em segundo plano para responder perguntas e resumir o pre-projeto.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <Card className="shadow-sm">
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label>Arquivo PDF</Label>
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-input px-4 py-2 text-sm transition-colors hover:bg-muted">
                  <Upload className="h-4 w-4" />
                  Selecionar arquivo
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
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
                Confirmo que todas as informacoes estao corretas e o documento esta assinado.
              </label>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" variant="action" size="lg" disabled={!file || !confirmed || isSubmitting} className="gap-2">
          {isSubmitting ? "Enviando e preparando IA..." : "Enviar Pre-Projeto"}
        </Button>
      </form>
    </div>
  );
};

export default SubmitProject;
