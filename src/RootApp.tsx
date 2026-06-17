import React, { useEffect } from "react";
import { getRouteSearchParams, useRoute, navigate } from "./router/router";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { HomePage } from "./pages/HomePage";
import { ProfilePage } from "./pages/ProfilePage";
import { AdminPage } from "./pages/AdminPage";
import { UserSession } from "./auth/UserSession";
import { AuthGuard } from "./router/AuthGuard";
import { AdminGuard } from "./router/AdminGuard";

export default function RootApp() {
  const route = useRoute();
  const homeInitialTab = getRouteSearchParams().get("tab") || "explore";
  const museumRouteId = route.startsWith("/museums/")
    ? decodeURIComponent(route.replace("/museums/", ""))
    : null;

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
      if (route === "/home" || route === "/swipe" || route === "/profile" || route === "/admin" || route.startsWith("/museums/")) {
        navigate("/login");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (route === "/register") return <RegisterPage />;
  if (route === "/home") return <AuthGuard><HomePage initialTab={homeInitialTab} /></AuthGuard>;
  if (museumRouteId) return <AuthGuard><HomePage initialTab="explore" initialMuseumId={museumRouteId} /></AuthGuard>;
  if (route === "/swipe") return <AuthGuard><HomePage initialTab="swipe" /></AuthGuard>;
  if (route === "/profile") return <AuthGuard><ProfilePage /></AuthGuard>;
  if (route === "/admin") return <AdminGuard><AdminPage /></AdminGuard>;
  return <LoginPage />;
}
