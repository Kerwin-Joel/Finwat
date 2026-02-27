import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import useAuthStore from "./stores/authStore";
import useThemeStore from "./stores/themeStore";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import AppLayout from "./components/layout/AppLayout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Transactions from "./pages/Transactions";
import Accounts from "./pages/Accounts";
import Services from "./pages/Services";
import Profile from "./pages/Profile";
import { Toaster } from "./components/ui/toaster";
import PublicRoute from "./components/layout/PublicRoute";

function App() {
  const initAuth = useAuthStore((state) => state.initAuth);
  const theme = useThemeStore((state) => state.theme);
  const customColors = useThemeStore((state) => state.customColors);

  // Initialize auth on mount
useEffect(() => {
  initAuth(); // se llama UNA SOLA VEZ cuando la app monta
}, [initAuth]);

  // Effect to apply theme
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark", "custom");
    root.classList.add(theme);

    // Apply custom colors if theme is custom
    if (theme === "custom") {
      root.style.setProperty("--primary", customColors.primary);
      root.style.setProperty("--border", customColors.primary);
      root.style.setProperty("--ring", customColors.primary);
      root.style.setProperty("--background", customColors.background);
      root.style.setProperty("--card", customColors.background);
      root.style.setProperty("--popover", customColors.background);
      root.style.setProperty("--foreground", customColors.foreground);
      root.style.setProperty("--card-foreground", customColors.foreground);
      root.style.setProperty("--popover-foreground", customColors.foreground);
      root.style.setProperty("--muted-foreground", customColors.foreground);
      root.style.setProperty("--accent-foreground", customColors.foreground);
      root.style.setProperty("--secondary-foreground", customColors.foreground);
    } else {
      // Clear custom properties when not in custom mode
      root.style.removeProperty("--primary");
      root.style.removeProperty("--border");
      root.style.removeProperty("--ring");
      root.style.removeProperty("--background");
      root.style.removeProperty("--card");
      root.style.removeProperty("--popover");
      root.style.removeProperty("--foreground");
      root.style.removeProperty("--card-foreground");
      root.style.removeProperty("--popover-foreground");
      root.style.removeProperty("--muted-foreground");
      root.style.removeProperty("--accent-foreground");
      root.style.removeProperty("--secondary-foreground");
    }
  }, [theme, customColors]);

  return (
    <BrowserRouter>
      {/* 
        Note: AnimatePresence mode="wait" works best with unique keys on Routes. 
        However, React Router v6 Routes don't accept keys easily for transitions 
        without a location hook wrapper. The AppLayout handles the page transition animation.
       */}
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        {/* <Route path="/login" element={<TestAuth />} /> */}
        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Home />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="services" element={<Services />} />
          <Route path="profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
