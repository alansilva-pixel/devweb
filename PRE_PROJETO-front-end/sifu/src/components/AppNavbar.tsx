import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut } from "lucide-react";
import sifuLogo from "@/assets/sifu.png";

const AppNavbar = () => {
  const { user, logout } = useAuth();
  const initials = user?.nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((name) => name[0]?.toUpperCase())
    .join("");

  return (
    <header className="bg-primary flex items-center justify-between gap-3 px-4 shadow-sm sm:px-6">
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
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border border-primary-foreground/40">
              <AvatarImage src={user.fotoUrl} alt={`Foto de ${user.nome}`} />
              <AvatarFallback className="bg-primary-foreground text-primary text-sm font-semibold">
                {initials || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 max-w-36 flex-col sm:max-w-48">
              <span className="truncate text-sm font-medium text-primary-foreground">{user.nome}</span>
              {user.email && (
                <span className="truncate text-xs text-primary-foreground/80">{user.email}</span>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={logout} className="text-primary-foreground hover:bg-primary/80">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      )}
    </header>
  );
};

export default AppNavbar;
