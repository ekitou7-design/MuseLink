import React from "react";
import { goBackOrNavigate } from "../router/router";

export function ForbiddenPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-3xl border border-gray-100 shadow-xl p-6 space-y-4">
        <div className="space-y-1">
          <div className="text-xl font-black text-gray-900">无权限访问</div>
          <div className="text-sm text-gray-500">当前账号没有后台管理权限，请使用管理员账号登录。</div>
        </div>

        <button
          onClick={() => goBackOrNavigate("/home")}
          className="w-full bg-amber-800 text-white rounded-2xl py-3 text-sm font-bold"
        >
          返回首页
        </button>
      </div>
    </div>
  );
}
