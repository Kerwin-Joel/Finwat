import React from "react";
import useAuthStore from "../../stores/authStore";
import { Navigate } from "react-router-dom";

interface PublicRoutesProps {
  children: React.ReactNode;
}

const PublicRoute: React.FC<PublicRoutesProps> = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);

  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
};

export default PublicRoute;
