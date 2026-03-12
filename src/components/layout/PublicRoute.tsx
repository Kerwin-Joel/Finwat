import React from "react";
import useAuthStore from "../../stores/authStore";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

interface PublicRoutesProps {
  children: React.ReactNode;
}

const PublicRoute: React.FC<PublicRoutesProps> = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isInitializing = useAuthStore((state) => state.isInitializing);

  // Solo muestra loading en la carga inicial, no durante el login
  if (isInitializing)
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );

  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
};

export default PublicRoute;
