import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle } from "lucide-react";

const Help = () => (
  <div className="max-w-2xl space-y-6">
    <h1 className="text-2xl font-bold text-primary">Ajuda</h1>
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center gap-3">
        <HelpCircle className="h-5 w-5 text-primary" />
        <CardTitle className="text-base">Perguntas Frequentes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <div>
          <p className="font-medium text-foreground">Como enviar meu pré-projeto?</p>
          <p>Acesse "Enviar Pré-Projeto" no menu lateral, preencha os dados e faça upload do PDF assinado.</p>
        </div>
        <div>
          <p className="font-medium text-foreground">Qual formato o arquivo deve ter?</p>
          <p>O arquivo deve ser um PDF único contendo todos os documentos necessários, com tamanho máximo de 10MB.</p>
        </div>
        <div>
          <p className="font-medium text-foreground">Como acompanho o status?</p>
          <p>Acesse "Minhas Submissões" para ver o histórico e status de cada envio.</p>
        </div>
      </CardContent>
    </Card>
  </div>
);

export default Help;
