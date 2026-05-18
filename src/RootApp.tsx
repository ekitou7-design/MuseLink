import React, { useEffect } from "react";
import { useRoute, navigate } from "./router/router";
import { LoginPage } from "./pages/LoginPage";
import { HomePage } from "./pages/HomePage";
import { ProfilePage } from "./pages/ProfilePage";
import { AdminPage } from "./pages/AdminPage";
import { UserSession } from "./auth/UserSession";
import { AuthGuard } from "./router/AuthGuard";
import { AdminGuard } from "./router/AdminGuard";

export default function RootApp() {
  const route = useRoute();

  // Auto-login / Auto-redirect on app start:
  // - If logged in -> go home
  // - If not -> go login
  useEffect(() => {
    const snap = UserSession.snapshot();
    if (snap.isLoggedIn && snap.token && snap.museId) {
      if (route === "/login" || route === "/register") {
        navigate("/home");
      }
    } else {
      if (route === "/home" || route === "/profile" || route === "/admin") {
        navigate("/login");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (route === "/register") return <LoginPage />;
  if (route === "/home") return <AuthGuard><HomePage /></AuthGuard>;
  if (route === "/profile") return <AuthGuard><ProfilePage /></AuthGuard>;
  if (route === "/admin") return <AdminGuard><AdminPage /></AdminGuard>;
  return <LoginPage />;
}
