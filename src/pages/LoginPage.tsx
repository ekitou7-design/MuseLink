import React, { useEffect, useMemo, useState } from "react";
import { AuthService } from "../auth/AuthService";
import { navigate } from "../router/router";
import type { LoginChannel } from "../lib/authClient";

const CODE_LENGTH = 6;

function normalizeTarget(channel: LoginChannel, value: string) {
  return channel === "phone" ? value.replace(/\s|-/g, "") : value.trim().toLowerCase();
}

function validateTarget(channel: LoginChannel, value: string) {
  const target = normalizeTarget(channel, value);
  if (channel === "phone") {
    return /^\+?\d{10,15}$/.test(target) ? null : "请输入有效手机号。";
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target) ? null : "请输入有效邮箱。";
}

export function LoginPage() {
  const [mode, setMode] = useState<"code" | "password">("code");
  const [channel, setChannel] = useState<LoginChannel>("phone");
  const [target, setTarget] = useState("");
  const [code, setCode] = useState("");
  const [museId, setMuseId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  const targetLabel = channel === "phone" ? "手机号" : "邮箱";
  const targetPlaceholder = channel === "phone" ? "请输入手机号" : "请输入邮箱";
  const normalizedTarget = useMemo(() => normalizeTarget(channel, target), [channel, target]);

  const switchChannel = (next: LoginChannel) => {
    setChannel(next);
    setTarget("");
    setCode("");
    setError(null);
    setInfo(null);
  };

  const switchMode = (next: "code" | "password") => {
    setMode(next);
    setError(null);
    setInfo(null);
    setCode("");
  };

  const requestCode = async () => {
    const message = validateTarget(channel, target);
    if (message) {
      setError(message);
      return;
    }

    setSending(true);
    setError(null);
    setInfo(null);
    try {
      const res = await AuthService.requestLoginCode(channel, normalizedTarget);
      const devSuffix = res.devCode ? ` 本地验证码：${res.devCode}` : "";
      setInfo(`验证码已发送，${Math.round(res.expiresIn / 60)} 分钟内有效。${devSuffix}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  const login = async (nextCode = code) => {
    if (loggingIn) return;
    const targetMessage = validateTarget(channel, target);
    if (targetMessage) {
      setError(targetMessage);
      return;
    }
    if (!/^\d{6}$/.test(nextCode)) {
      setError("请输入 6 位验证码。");
      return;
    }

    setLoggingIn(true);
    setError(null);
    try {
      await AuthService.loginWithCode(channel, normalizedTarget, nextCode);
      navigate("/home");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoggingIn(false);
    }
  };

  const loginWithPassword = async () => {
    if (loggingIn) return;
    const normalizedMuseId = museId.trim();
    if (!/^[A-Za-z0-9_-]{4,24}$/.test(normalizedMuseId)) {
      setError("登录账号必须是 4~24 位字母、数字、下划线或短横线。");
      return;
    }
    if (!password) {
      setError("请输入密码。");
      return;
    }

    setLoggingIn(true);
    setError(null);
    try {
      await AuthService.login(normalizedMuseId, password);
      navigate("/home");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoggingIn(false);
    }
  };

  useEffect(() => {
    if (mode === "code" && code.length === CODE_LENGTH) {
      void login(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, mode]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F4ED] p-6">
      <main className="w-full max-w-sm bg-white border border-stone-200 rounded-[5px] shadow-xl p-6 space-y-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-stone-950">MuseLink 登录</h1>
          <p className="text-sm text-stone-500">
            {mode === "code" ? "验证码即登录，新用户会自动创建账号。" : "使用 MuseLink ID 和密码登录。"}
          </p>
        </div>

        <div className="grid grid-cols-2 rounded-[5px] bg-stone-100 p-1">
          <button
            type="button"
            onClick={() => switchMode("code")}
            className={`rounded-[5px] py-2 text-sm font-bold transition ${
              mode === "code" ? "bg-white text-stone-950 shadow-sm" : "text-stone-500"
            }`}
          >
            验证码
          </button>
          <button
            type="button"
            onClick={() => switchMode("password")}
            className={`rounded-[5px] py-2 text-sm font-bold transition ${
              mode === "password" ? "bg-white text-stone-950 shadow-sm" : "text-stone-500"
            }`}
          >
            ID 密码
          </button>
        </div>

        <div className="space-y-3">
          {mode === "code" ? (
            <>
              <div className="grid grid-cols-2 rounded-[5px] bg-stone-100 p-1">
                <button
                  type="button"
                  onClick={() => switchChannel("phone")}
                  className={`rounded-[5px] py-2 text-sm font-bold transition ${
                    channel === "phone" ? "bg-white text-stone-950 shadow-sm" : "text-stone-500"
                  }`}
                >
                  手机号
                </button>
                <button
                  type="button"
                  onClick={() => switchChannel("email")}
                  className={`rounded-[5px] py-2 text-sm font-bold transition ${
                    channel === "email" ? "bg-white text-stone-950 shadow-sm" : "text-stone-500"
                  }`}
                >
                  邮箱
                </button>
              </div>

              <label className="block space-y-2">
                <span className="text-xs font-bold text-stone-600">{targetLabel}</span>
                <input
                  className="w-full rounded-[5px] border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none focus:border-amber-800 focus:ring-2 focus:ring-amber-800/15"
                  placeholder={targetPlaceholder}
                  inputMode={channel === "phone" ? "tel" : "email"}
                  autoComplete={channel === "phone" ? "tel" : "email"}
                  value={target}
                  onChange={(e) => {
                    setTarget(e.target.value);
                    setError(null);
                  }}
                />
              </label>

              <button
                type="button"
                onClick={requestCode}
                disabled={sending || loggingIn}
                className="w-full rounded-[5px] bg-stone-950 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {sending ? "发送中..." : "获取验证码"}
              </button>

              <label className="block space-y-2">
                <span className="text-xs font-bold text-stone-600">验证码</span>
                <input
                  className="w-full rounded-[5px] border border-stone-200 bg-stone-50 px-4 py-3 text-center text-xl font-black tracking-[0.35em] outline-none focus:border-amber-800 focus:ring-2 focus:ring-amber-800/15"
                  placeholder="000000"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={CODE_LENGTH}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH));
                    setError(null);
                  }}
                />
              </label>
            </>
          ) : (
            <>
              <label className="block space-y-2">
                <span className="text-xs font-bold text-stone-600">MuseLink ID</span>
                <input
                  className="w-full rounded-[5px] border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none focus:border-amber-800 focus:ring-2 focus:ring-amber-800/15"
                  placeholder="请输入 MuseLink ID 或管理员账号"
                  autoComplete="username"
                  value={museId}
                  onChange={(e) => {
                    setMuseId(e.target.value.replace(/[^\w-]/g, "").slice(0, 24));
                    setError(null);
                  }}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-bold text-stone-600">密码</span>
                <input
                  className="w-full rounded-[5px] border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none focus:border-amber-800 focus:ring-2 focus:ring-amber-800/15"
                  placeholder="请输入密码"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      void loginWithPassword();
                    }
                  }}
                />
              </label>
            </>
          )}

          {info && <div className="rounded-[5px] bg-emerald-50 p-3 text-xs text-emerald-800">{info}</div>}
          {error && <div className="rounded-[5px] bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}

          <button
            type="button"
            onClick={() => (mode === "code" ? login() : loginWithPassword())}
            disabled={loggingIn || (mode === "code" && code.length !== CODE_LENGTH)}
            className="w-full rounded-[5px] bg-amber-800 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {loggingIn ? "登录中..." : "登录"}
          </button>
        </div>
      </main>
    </div>
  );
}
