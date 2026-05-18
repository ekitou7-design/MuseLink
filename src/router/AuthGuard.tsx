import React, { useEffect } from "react";
import { navigate } from "./router";
import { isUserAuthenticated } from "./authChecks";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!isUserAuthenticated()) {
      navigate("/login");
    }
  }, []);

  if (!isUserAuthenticated()) {
    return null;
  }

  return <>{children}</>;
}

