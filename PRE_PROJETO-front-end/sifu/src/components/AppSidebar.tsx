import { NavLink } from "react-router-dom";
import { LayoutDashboard, Send, FileText, HelpCircle } from "lucide-react";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/enviar", label: "Enviar Pré-Projeto", icon: Send },
  { to: "/submissoes", label: "Minhas Submissões", icon: FileText },
  { to: "/ajuda", label: "Ajuda", icon: HelpCircle },
];

const AppSidebar = () => {
  return (
    <aside className="w-60 min-h-[calc(100vh-3.5rem)] bg-card border-r border-border flex flex-col py-4">
      <nav className="flex flex-col gap-1 px-3">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              }`
            }
          >
            <link.icon className="h-4 w-4" />
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default AppSidebar;
