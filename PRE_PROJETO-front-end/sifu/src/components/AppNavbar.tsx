import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import sifuLogo from "@/assets/sifu.png";

const AppNavbar = () => {
  const { user, logout } = useAuth();

  return (
    <header className="bg-primary flex items-center justify-between px-6 shadow-sm">
      <a
        href="https://sifu.web.ufersa.dev.br/"
        target="_self"
        rel="noopener noreferrer"
        className="hover:opacity-80 transition-opacity p-3"
        title="retorno para SIFU"
      >
        <img src={sifuLogo} alt="SIFU" width={64} height={64} className="rounded" />
      </a>
      {user && (
        <div className="flex items-center gap-4">
          <span className="text-primary-foreground text-sm">{user.nome}</span>
          <Button variant="ghost" size="icon" onClick={logout} className="text-primary-foreground hover:bg-primary/80">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      )}
    </header>
  );
};

export default AppNavbar;