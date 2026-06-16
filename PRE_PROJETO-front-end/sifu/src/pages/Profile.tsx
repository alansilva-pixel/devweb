import { FormEvent, useMemo, useState } from "react";
import { Camera, Save, UserRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type SavedProfile = {
  email: string;
  nome: string;
  matricula: string;
  curso: string;
  telefone: string;
  bio: string;
  photoUri: string;
  updatedAt: string;
};

const apiUrl = import.meta.env.VITE_PROFILE_API_URL as string | undefined;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const Profile = () => {
  const { user } = useAuth();
  const [nome, setNome] = useState(user?.nome || "");
  const [email, setEmail] = useState(user?.email || "");
  const [matricula, setMatricula] = useState(user?.matricula || "");
  const [curso, setCurso] = useState("Ciência da Computação");
  const [telefone, setTelefone] = useState("");
  const [bio, setBio] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [savedProfile, setSavedProfile] = useState<SavedProfile | null>(null);
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const pageUrl = useMemo(() => window.location.href, []);
  const currentPhotoUrl = previewUrl || user?.fotoUrl || "";

  const handlePhotoChange = (file?: File) => {
    if (!file) return;
    setPhotoFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("");

    if (!apiUrl) {
      setStatus("Configure VITE_PROFILE_API_URL com a URL do output ProfileApiUrl.");
      return;
    }

    if (!photoFile) {
      setStatus("Selecione uma foto de perfil diferente da foto do login.");
      return;
    }

    setIsSaving(true);

    try {
      const photoBase64 = await readFileAsDataUrl(photoFile);
      const response = await fetch(apiUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome,
          email,
          matricula,
          curso,
          telefone,
          bio,
          photoFileName: photoFile.name,
          photoContentType: photoFile.type,
          photoBase64,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Não foi possível atualizar o perfil.");
      }

      setSavedProfile(data.profile);
      setStatus(data.message || "Perfil atualizado com sucesso.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível atualizar o perfil.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-primary">Perfil do Usuário</h1>
        <p className="text-sm text-muted-foreground">{pageUrl}</p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center gap-3">
            <UserRound className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Foto de perfil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md border bg-muted">
              {currentPhotoUrl ? (
                <img src={currentPhotoUrl} alt="Foto de perfil" className="h-full w-full object-cover" />
              ) : (
                <Camera className="h-12 w-12 text-muted-foreground" />
              )}
            </div>
            <Input
              type="file"
              accept="image/*"
              onChange={(event) => handlePhotoChange(event.target.files?.[0])}
            />
            <p className="text-xs text-muted-foreground">
              Selecione uma imagem nova para gravar no bucket S3 da atividade.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Dados cadastrais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" value={nome} onChange={(event) => setNome(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="matricula">Matrícula</Label>
                <Input id="matricula" value={matricula} onChange={(event) => setMatricula(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="curso">Curso</Label>
                <Input id="curso" value={curso} onChange={(event) => setCurso(event.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input id="telefone" value={telefone} onChange={(event) => setTelefone(event.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="bio">Informações do usuário</Label>
                <Textarea id="bio" value={bio} onChange={(event) => setBio(event.target.value)} />
              </div>
            </div>

            <Button type="submit" disabled={isSaving} className="gap-2">
              <Save className="h-4 w-4" />
              {isSaving ? "Salvando..." : "Salvar perfil"}
            </Button>

            {status && <p className="text-sm font-medium text-primary">{status}</p>}

            {savedProfile && (
              <div className="rounded-md border bg-muted/40 p-4 text-sm">
                <p className="font-medium text-foreground">Perfil salvo no DynamoDB</p>
                <p className="text-muted-foreground">{savedProfile.email}</p>
                <p className="text-muted-foreground">{savedProfile.photoUri}</p>
                <p className="text-muted-foreground">Atualizado em {savedProfile.updatedAt}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </div>
  );
};

export default Profile;
