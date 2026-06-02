import { useEffect } from 'react';
import {
  ChevronRight,
  Copyright,
  ExternalLink,
  HelpCircle,
  Info,
  Library,
  LogOut,
  Settings,
  User,
  X,
} from 'lucide-react';
import { logout as jwtLogout } from '../../lib/authClient';

export const Drawer = ({ 
  isOpen, 
  onClose, 
  user, 
  onLoginClick, 
  onEditProfile, 
  onSettingsClick, 
  onFeatureClick 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  user: { id: number; displayName: string; photoURL: string } | null, 
  onLoginClick: () => void,
  onEditProfile: () => void,
  onSettingsClick: () => void,
  onFeatureClick: (title: string) => void
}) => {
  const closeDrawer = (event?: { preventDefault?: () => void; stopPropagation?: () => void }) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
  <>
    <button
      type="button"
      aria-label="关闭侧边栏"
      className="drawer-overlay open"
      onPointerDown={closeDrawer}
      onTouchStart={closeDrawer}
      onClick={closeDrawer}
    />
    <aside className="drawer-content open flex flex-col p-5">
      <button
        type="button"
        aria-label="关闭侧边栏"
        onPointerDown={closeDrawer}
        onTouchStart={closeDrawer}
        onClick={closeDrawer}
        className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-gray-500 shadow-sm transition-colors hover:bg-gray-100"
      >
        <X size={18} />
      </button>
      {user ? (
        <div className="mb-8 space-y-5 pr-8">
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('change-tab', { detail: 'profile' })); }}>
            <img src={user?.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200'} className="h-14 w-14 rounded-full shadow-sm" />
            <div>
              <h3 className="font-bold text-lg text-secondary font-serif">{user?.displayName || '游客'}</h3>
              <p className="text-xs text-gray-400">点击查看个人主页</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => { onClose(); onEditProfile(); }}
              className="ios-button-medium flex items-center justify-center gap-2 bg-white text-xs font-bold text-secondary transition-all hover:bg-gray-100 border border-black/5"
            >
              <User size={20} />
              编辑资料
            </button>
            <button 
              onClick={() => { onClose(); jwtLogout(); window.location.reload(); }}
              className="ios-button-medium flex items-center justify-center gap-2 bg-rose-50 text-xs font-bold text-rose-600 transition-all hover:bg-rose-100"
            >
              <LogOut size={20} />
              退出登录
            </button>
          </div>
        </div>
      ) : (
        <div className="ios-card mb-8 p-5">
          <h3 className="font-bold text-secondary mb-2 font-serif">欢迎来到博悟</h3>
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">登录后即可同步收藏、创建展陈并与同好互动交流。</p>
          <button 
            onClick={() => { onClose(); onLoginClick(); }}
            className="ios-button-large w-full bg-primary text-sm font-bold text-white shadow-lg shadow-primary/20"
          >
            立即登录 / 注册
          </button>
        </div>
      )}

      <div className="flex-1 space-y-2">
        {[
          { icon: Info, label: '文博资讯与线下展览', color: 'text-blue-500' },
          { icon: Library, label: '文博知识库', color: 'text-amber-600' },
          { icon: HelpCircle, label: '使用帮助与反馈', color: 'text-gray-500' },
          { icon: Settings, label: '通用设置', color: 'text-gray-500', action: onSettingsClick },
          { icon: Copyright, label: '来源公示与版权声明', color: 'text-gray-400' },
          { icon: ExternalLink, label: '关于我们', color: 'text-gray-400' },
        ].map((item) => (
          <button 
              key={item.label} 
              onClick={() => {
                onClose();
                if (item.action) item.action();
                else onFeatureClick(item.label);
              }}
              className="ios-list-row flex w-full items-center gap-4 rounded-2xl px-3 text-left transition-colors hover:bg-white/80"
            >
              <item.icon size={20} className={item.color} />
              <span className="text-sm font-medium text-gray-700">{item.label}</span>
              <ChevronRight size={20} className="ml-auto text-gray-300" />
            </button>
        ))}
      </div>

      <div className="mt-auto pt-6 border-t border-gray-50 flex items-center justify-between text-[10px] text-gray-300 font-medium">
        <span>版本 1.2.4</span>
        <span>© 2024 博悟 MuseLink</span>
      </div>
    </aside>
  </>
  );
};
