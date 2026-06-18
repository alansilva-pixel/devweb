import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import ufersaLogo from "@/assets/ufersa-logo.png";
import sifuLogo from "@/assets/sifu.png";

const Login = () => {
  const { login } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleGoogleLogin = async () => {
    setIsRedirecting(true);
    try {
      await login();
    } catch {
      setIsRedirecting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background">
      <a
        href="https://sifu.web.ufersa.dev.br/"
        className="absolute left-6 top-6 transition-opacity hover:opacity-80"
        title="retorno para SIFU"
      >
        <img src={sifuLogo} alt="SIFU" width={64} height={64} className="rounded" />
      </a>
      <Card className="w-full max-w-md rounded-lg shadow-lg">
        <CardContent className="px-8 pb-8 pt-8">
          <div className="mb-8 flex flex-col items-center">
            <img src={ufersaLogo} alt="UFERSA" width={120} height={120} className="mb-4" />
            <h1 className="text-center text-xl font-bold text-primary">
              SIFU - Sistema Integrado Academico
            </h1>
            <p className="mt-3 text-center text-sm text-muted-foreground">
              Faça login com sua conta Google institucional.
            </p>
          </div>

          <Button
            variant="outline"
            className="w-full"
            size="lg"
            onClick={handleGoogleLogin}
            disabled={isRedirecting}
          >
            <img
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
              className="mr-2 h-5 w-5"
              alt=""
            />
            {isRedirecting ? "Abrindo Google..." : "Entrar com Google"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
