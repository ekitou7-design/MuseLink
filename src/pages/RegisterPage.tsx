import React, { useState } from "react";
import { AuthService } from "../auth/AuthService";
import { goBackOrNavigate, navigate } from "../router/router";
import {
  copyToClipboard,
  getStoredMuseId,
  saveMuseId,
  clearStoredMuseId,
} from "../lib/authUtils";

function RegisterSuccessView({
  museId,
  copyMessage,
  onCopy,
  onContinue,
  onReset,
}: {
  museId: string;
  copyMessage: string | null;
  onCopy: () => Promise<void>;
  onContinue: () => void;
  onReset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-emerald-50 via-white to-white p-6">
      <div className="w-full max-w-md bg-white rounded-[32px] shadow-2xl border border-emerald-100 p-7 space-y-6">
        <button
          type="button"
          onClick={() => goBackOrNavigate("/login")}
          className="text-xs font-bold text-gray-400"
        >
          返回
        </button>
        <div className="space-y-3 text-center">
          <div className="inline-flex items-center rounded-full bg-emerald-700 px-4 py-1.5 text-xs font-black text-white">
            注册成功
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-gray-950">你的 MuseLink ID 已创建</h1>
            <p className="text-sm leading-6 text-gray-500">
              这是你之后登录 MuseLink 的唯一 ID。请先复制或记下它，再继续下一步。
            </p>
          </div>
        </div>

        <div className="rounded-[28px] border-2 border-emerald-200 bg-emerald-50 px-5 py-6 text-center shadow-lg shadow-emerald-100/70">
          <div className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-700">MuseLink ID</div>
          <div className="mt-3 text-4xl font-black tracking-[0.32em] text-emerald-950">{museId}</div>
        </div>

        {copyMessage && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
            {copyMessage}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={onCopy}
            className="w-full rounded-2xl border border-emerald-300 bg-white py-3 text-sm font-bold text-emerald-900"
          >
            复制 ID
          </button>

          <button
            onClick={onContinue}
            className="w-full rounded-2xl bg-emerald-700 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-700/20"
          >
            进入应用
          </button>
        </div>

        <div className="rounded-2xl bg-gray-50 px-4 py-3 text-xs leading-5 text-gray-500">
          点击“进入应用”后，会自动带着这个 ID 去登录页。你只需要输入刚刚设置的密码即可继续。
        </div>

        <button
          onClick={onReset}
          className="w-full py-2 text-xs font-bold text-gray-400"
        >
          我想重新注册其他账号
        </button>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registeredMuseId, setRegisteredMuseId] = useState<string | null>(() => getStoredMuseId());
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const onRegister = async () => {
    setLoading(true);
    setError(null);
    setCopyMessage(null);
    try {
      const res = await AuthService.register(password, confirmPassword);
      saveMuseId(res.museId);
      setRegisteredMuseId(res.museId);
      setPassword("");
      setConfirmPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const onCopyMuseId = async () => {
    if (!registeredMuseId) return;

    try {
      await copyToClipboard(registeredMuseId);
      setCopyMessage("MuseLink ID 已复制，现在可以继续进入应用。");
    } catch (e) {
      setCopyMessage(e instanceof Error ? e.message : "复制失败，请手动记下 MuseLink ID。");
    }
  };

  const onContinue = () => {
    if (!registeredMuseId) {
      navigate("/login");
      return;
    }

    navigate("/login", { museId: registeredMuseId });
  };

  const onReset = () => {
    clearStoredMuseId();
    setRegisteredMuseId(null);
    setCopyMessage(null);
    setError(null);
    setPassword("");
    setConfirmPassword("");
  };

  if (registeredMuseId) {
    return (
      <RegisterSuccessView
        museId={registeredMuseId}
        copyMessage={copyMessage}
        onCopy={onCopyMuseId}
        onContinue={onContinue}
        onReset={onReset}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-gray-100 p-6 space-y-4">
        <button
          type="button"
          onClick={() => goBackOrNavigate("/login")}
          className="text-xs font-bold text-gray-400"
        >
          返回
        </button>
        <div className="space-y-1">
          <h1 className="text-xl font-black text-gray-900">MuseLink 注册</h1>
          <p className="text-xs text-gray-500">注册后会生成唯一 MuseLink ID（请务必保存）</p>
        </div>

        <div className="space-y-3">
          <input
            className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-700/20 outline-none"
            placeholder="密码（至少8位）"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-700/20 outline-none"
            placeholder="确认密码"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          {error && <div className="text-xs text-rose-600 bg-rose-50 p-3 rounded-2xl">{error}</div>}

          <button
            onClick={onRegister}
            disabled={loading}
            className="w-full bg-amber-800 text-white rounded-2xl py-3 text-sm font-bold disabled:opacity-50"
          >
            {loading ? "注册中..." : "注册"}
          </button>

          <button
            onClick={() => navigate("/login")}
            className="w-full text-sm font-bold text-gray-500 py-2"
          >
            已有账号？去登录
          </button>
        </div>
      </div>
    </div>
  );
}
