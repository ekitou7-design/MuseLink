import React, { useEffect, useState } from "react";
import { ForbiddenPage } from "../pages/ForbiddenPage";
import { navigate } from "./router";
import { isCurrentUserAdmin, isUserAuthenticated } from "./authChecks";

type AdminGuardState = "checking" | "allowed" | "forbidden";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AdminGuardState>("checking");

  useEffect(() => {
    if (!isUserAuthenticated()) {
      navigate("/login");
      return;
    }

    let cancelled = false;

    isCurrentUserAdmin()
      .then((isAdmin) => {
        if (cancelled) return;
        setState(isAdmin ? "allowed" : "forbidden");
      })
      .catch(() => {
        if (cancelled) return;
        setState("forbidden");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!isUserAuthenticated()) {
    return null;
  }

  if (state === "checking") {
    return null;
  }

  if (state === "forbidden") {
    return <ForbiddenPage />;
  }

  return <>{children}</>;
}
