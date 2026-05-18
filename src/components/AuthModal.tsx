import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Lock, 
  ShieldCheck, 
  ArrowRight, 
  Loader2,
  Eye,
  EyeOff,
  Copy,
} from 'lucide-react';
import { login, register } from '../lib/authClient';
import {
  copyToClipboard,
  getStoredMuseId,
  saveMuseId,
  clearStoredMuseId,
  normalizeMuseId,
  MUSE_ID_REGEX,
} from '../lib/authUtils';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'registerSuccess'>('login');
  const [museId, setMuseId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registeredMuseId, setRegisteredMuseId] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const handleCopyMuseId = async () => {
    if (!registeredMuseId) return;

    try {
      await copyToClipboard(registeredMuseId);
      setCopyMessage("MuseLink ID 已复制，现在可以继续进入应用。");
    } catch (e) {
      setCopyMessage(e instanceof Error ? e.message : "复制失败，请手动记下 MuseLink ID。");
    }
  };

  const handleContinue = () => {
    if (!registeredMuseId) {
      setMode("login");
      return;
    }

    setMuseId(registeredMuseId);
    setMode("login");
  };

  const handleReset = () => {
    clearStoredMuseId();
    setRegisteredMuseId(null);
    setCopyMessage(null);
    setError(null);
    setPassword("");
    setConfirmPassword("");
    setMode("register");
  };

  const handleAuth = async () => {
    setLoading(true);
    setError(null);
    setCopyMessage(null);
    try {
      if (mode === "register") {
        const r = await register(password, confirmPassword);
        saveMuseId(r.museId);
        setRegisteredMuseId(r.museId);
        setMode("registerSuccess");
        setPassword("");
        setConfirmPassword("");
      } else {
        const trimmed = museId.trim();
        if (!MUSE_ID_REGEX.test(trimmed)) {
          throw new Error("请输入有效的 MuseLink 登录账号。");
        }
        await login(trimmed, password);
        onSuccess?.();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all"
            >
              <X size={20} />
            </button>

            <div className="p-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="text-emerald-700" size={32} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {mode === 'login' ? '欢迎回来' : mode === 'register' ? '开启博悟之旅' : '注册成功'}
                </h2>
                <p className="text-sm text-gray-500 mt-2">
                  {mode === 'login' ? '登录后同步您的收藏与展陈' : mode === 'register' ? '注册账号，定制您的数字博物馆' : '你的 MuseLink ID 已创建'}
                </p>
              </div>

              {mode === 'registerSuccess' ? (
                <div className="space-y-6">
                  <div className="rounded-[28px] border-2 border-emerald-200 bg-emerald-50 px-5 py-6 text-center shadow-lg shadow-emerald-100/70">
                    <div className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-700">MuseLink ID</div>
                    <div className="mt-3 text-4xl font-black tracking-[0.32em] text-emerald-950">{registeredMuseId}</div>
                  </div>

                  {copyMessage && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
                      {copyMessage}
                    </div>
                  )}

                  <div className="space-y-3">
                    <button
                      onClick={handleCopyMuseId}
                      className="w-full rounded-2xl border border-emerald-300 bg-white py-3 text-sm font-bold text-emerald-900 flex items-center justify-center gap-2"
                    >
                      <Copy size={16} />
                      复制 ID
                    </button>

                    <button
                      onClick={handleContinue}
                      className="w-full rounded-2xl bg-emerald-700 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-700/20 flex items-center justify-center gap-2"
                    >
                      进入应用
                      <ArrowRight size={16} />
                    </button>
                  </div>

                  <div className="rounded-2xl bg-gray-50 px-4 py-3 text-xs leading-5 text-gray-500">
                    点击"进入应用"后，会自动带着这个 ID 去登录页。你只需要输入刚刚设置的密码即可继续。
                  </div>

                  <button
                    onClick={handleReset}
                    className="w-full py-2 text-xs font-bold text-gray-400"
                  >
                    我想重新注册其他账号
                  </button>
                </div>
              ) : (
                <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                  <div className="space-y-4">
                    {mode === "login" && (
                      <div className="relative">
                        <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                          type="text"
                          placeholder="请输入 MuseLink ID 或管理员账号"
                          value={museId}
                          onChange={(e) => setMuseId(e.target.value.replace(/[^\w-]/g, "").slice(0, 24))}
                          required
                          className="w-full bg-gray-50 border-none rounded-2xl py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-amber-700/20 transition-all"
                        />
                      </div>
                    )}

                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        type={showPassword ? "text" : "password"}
                        placeholder="请输入密码（至少8位）"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                        maxLength={64}
                        className="w-full bg-gray-50 border-none rounded-2xl py-3 pl-12 pr-12 text-sm focus:ring-2 focus:ring-amber-700/20 transition-all"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>

                    {mode === "register" && (
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="请再次输入密码"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          minLength={8}
                          maxLength={64}
                          className="w-full bg-gray-50 border-none rounded-2xl py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-amber-700/20 transition-all"
                        />
                      </div>
                    )}
                  </div>

                  {error && (
                    <p className="text-xs text-rose-500 bg-rose-50 p-3 rounded-xl flex items-center gap-2">
                      <X size={14} />
                      {error}
                    </p>
                  )}

                  <button 
                    type="button"
                    onClick={handleAuth}
                    disabled={loading}
                    className="w-full bg-amber-800 text-white py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-amber-900 transition-all shadow-lg shadow-amber-800/20 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : (
                      <>
                        {mode === 'login' ? '立即登录' : '立即注册'}
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>

                  {mode === 'login' && (
                    <button 
                      type="button"
                      onClick={onClose}
                      className="w-full py-3 text-sm font-bold text-gray-400 hover:text-gray-600 transition-all"
                    >
                      先去逛逛 (游客模式)
                    </button>
                  )}
                </form>
              )}

              <div className="mt-8 text-center space-y-4">
                {mode !== 'registerSuccess' && (
                  <button 
                    onClick={() => {
                      setMode(mode === 'login' ? 'register' : 'login');
                      setError(null);
                    }}
                    className="text-sm text-gray-500 hover:text-amber-800 transition-colors"
                  >
                    {mode === 'login' ? '还没有账号？立即注册' : '已有账号？返回登录'}
                  </button>
                )}
              </div>
            </div>
            
            <div className="bg-gray-50 p-6 text-center space-y-4">
              <button 
                onClick={onClose}
                className="text-xs font-bold text-gray-500 hover:text-amber-800 transition-colors"
              >
                先去逛逛，以后再登录
              </button>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                登录即代表您同意 <span className="text-amber-800 font-bold">《用户协议》</span> 和 <span className="text-amber-800 font-bold">《隐私政策》</span>
                <br />
                博悟 MuseLink 承诺保护您的个人隐私
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
