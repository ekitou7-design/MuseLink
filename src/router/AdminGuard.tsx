import React, { useEffect } from "react";
import { ForbiddenPage } from "../pages/ForbiddenPage";
import { navigate } from "./router";
import { isUserAuthenticated, isUserAdmin } from "./authChecks";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!isUserAuthenticated()) {
      navigate("/login");
    }
  }, []);

  if (!isUserAuthenticated()) {
    return null;
  }

  if (!isUserAdmin()) {
    return <ForbiddenPage />;
  }

  return <>{children}</>;
}
