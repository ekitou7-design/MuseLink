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
} from 'lucide-react';
import { logout as jwtLogout } from '../../lib/authClient';
import { cn } from '../../lib/utils';

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
}) => (
  <>
    <div className={cn("drawer-overlay", isOpen && "open")} onClick={onClose} />
    <div className={cn("drawer-content p-6 flex flex-col", isOpen && "open")}>
      {user ? (
        <div className="space-y-6 mb-10">
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('change-tab', { detail: 'profile' })); }}>
            <img src={user?.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200'} className="w-14 h-14 rounded-2xl shadow-sm" />
            <div>
              <h3 className="font-bold text-lg text-secondary font-serif">{user?.displayName || '游客'}</h3>
              <p className="text-xs text-gray-400">点击查看个人主页</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => { onClose(); onEditProfile(); }}
              className="flex items-center justify-center gap-2 py-2.5 bg-neutral text-secondary rounded-xl text-xs font-bold hover:bg-gray-100 transition-all border border-gray-100"
            >
              <User size={20} />
              编辑资料
            </button>
            <button 
              onClick={() => { onClose(); jwtLogout(); window.location.reload(); }}
              className="flex items-center justify-center gap-2 py-2.5 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-100 transition-all"
            >
              <LogOut size={20} />
              退出登录
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-10 p-6 bg-neutral rounded-3xl border border-gray-100">
          <h3 className="font-bold text-secondary mb-2 font-serif">欢迎来到博悟</h3>
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">登录后即可同步收藏、创建展陈并与同好互动交流。</p>
          <button 
            onClick={() => { onClose(); onLoginClick(); }}
            className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20"
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
              className="w-full flex items-center gap-4 p-3 hover:bg-gray-50 rounded-xl transition-colors text-left"
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
    </div>
  </>
);
