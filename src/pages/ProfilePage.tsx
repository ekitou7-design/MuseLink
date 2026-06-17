import React, { useEffect, useState } from "react";
import { UserSession } from "../auth/UserSession";
import { AuthService } from "../auth/AuthService";
import { goBackOrNavigate, navigate } from "../router/router";
import { me } from "../lib/authClient";

export function ProfilePage() {
  const [museId, setMuseId] = useState<string | null>(null);
  const [role, setRole] = useState<"user" | "admin" | null>(null);
  const [canAccessAdmin, setCanAccessAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setMuseId(UserSession.getMuseId());
    setRole(null);
    setCanAccessAdmin(false);

    me()
      .then((currentUser) => {
        if (cancelled) return;
        const currentRole = currentUser.profile.role === "admin" ? "admin" : "user";
        setRole(currentRole);
        setCanAccessAdmin(currentRole === "admin");
      })
      .catch(() => {
        if (cancelled) return;
        setRole(null);
        setCanAccessAdmin(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const onLogout = async () => {
    await AuthService.logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-md mx-auto space-y-4">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <button
            type="button"
            onClick={() => goBackOrNavigate("/home")}
            className="mb-4 text-xs font-bold text-gray-400"
          >
            返回首页
          </button>
          <div className="text-sm font-black text-gray-900">个人中心</div>
          <div className="text-xs text-gray-500 mt-1">你的 MuseLink 身份</div>
          <div className="mt-4 bg-gray-50 rounded-2xl p-4">
            <div className="text-xs text-gray-500">MuseLink ID</div>
            <div className="text-2xl font-black tracking-widest">{museId || "-"}</div>
          </div>
          <div className="mt-3 bg-gray-50 rounded-2xl p-4">
            <div className="text-xs text-gray-500">账号角色</div>
            <div className="text-lg font-black text-gray-900">{role || "-"}</div>
          </div>
          {canAccessAdmin && (
            <button
              onClick={() => navigate("/admin")}
              className="w-full mt-4 bg-emerald-50 text-emerald-700 rounded-2xl py-3 text-sm font-black"
            >
              后台管理
            </button>
          )}
          <button
            onClick={onLogout}
            className="w-full mt-4 bg-rose-50 text-rose-700 rounded-2xl py-3 text-sm font-black"
          >
            退出登录
          </button>
        </div>

        <button
          onClick={() => navigate("/home")}
          className="w-full text-sm font-bold text-gray-500"
        >
          返回首页
        </button>
      </div>
    </div>
  );
}
