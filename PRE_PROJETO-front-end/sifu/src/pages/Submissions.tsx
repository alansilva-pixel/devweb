import { useSubmissions } from "@/contexts/SubmissionContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

const statusColors: Record<string, string> = {
  "Em análise": "bg-yellow-100 text-yellow-800",
  "Aprovado": "bg-green-100 text-green-800",
};

const Submissions = () => {
  const { submissions } = useSubmissions();

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-primary">Minhas Submissões</h1>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma submissão encontrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell>{sub.date}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[sub.status] || "bg-muted"}>{sub.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{sub.fileName}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="gap-1">
                        <Download className="h-3.5 w-3.5" />
                        Baixar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Submissions;
