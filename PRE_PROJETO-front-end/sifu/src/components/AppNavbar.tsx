import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import ufersaLogo from "@/assets/ufersa-logo.png";

const AppNavbar = () => {
  const { user, logout } = useAuth();

  return (
    <header className="h-14 bg-primary flex items-center justify-between px-6 shadow-sm">
      <div className="flex items-center gap-3">
        <img src={ufersaLogo} alt="UFERSA" width={36} height={36} className="bg-primary-foreground rounded-full p-0.5" />
        <span className="text-primary-foreground font-bold text-lg tracking-tight">SIFU</span>
      </div>
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