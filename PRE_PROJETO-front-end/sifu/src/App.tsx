import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SubmissionProvider } from "@/contexts/SubmissionContext";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import SubmitProject from "@/pages/SubmitProject";
import Confirmation from "@/pages/Confirmation";
import Submissions from "@/pages/Submissions";
import Help from "@/pages/Help";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const AuthGate = () => {
  const { user } = useAuth();
  if (!user) return <Login />;
  return (
    <SubmissionProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/enviar" element={<SubmitProject />} />
          <Route path="/confirmacao" element={<Confirmation />} />
          <Route path="/submissoes" element={<Submissions />} />
          <Route path="/ajuda" element={<Help />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </SubmissionProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
