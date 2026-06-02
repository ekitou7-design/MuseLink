import { Compass, Library, User } from 'lucide-react';
import { cn } from '../../lib/utils';

export const BottomNav = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) => (
  <nav className="ios-float-nav fixed bottom-0 left-0 right-0 z-[90] flex items-start justify-center bg-gradient-to-t from-white via-white/96 to-white/0 px-5 pt-2">
    <div className="ios-pill grid h-[62px] w-full max-w-[340px] grid-cols-3 items-center px-2">
      {[
        { id: 'explore', icon: Compass, label: '探索' },
        { id: 'exhibition', icon: Library, label: '展陈' },
        { id: 'profile', icon: User, label: '我的' },
      ].map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveTab(item.id)}
          className={cn(
            "mx-1 flex h-12 flex-col items-center justify-center gap-0.5 rounded-full transition-all duration-300",
            activeTab === item.id ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-800"
          )}
        >
          <item.icon size={22} strokeWidth={activeTab === item.id ? 2.6 : 2.1} />
          <span className="text-[10px] font-bold leading-none">{item.label}</span>
        </button>
      ))}
    </div>
  </nav>
);
