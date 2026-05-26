import { Compass, Library, User } from 'lucide-react';
import { cn } from '../../lib/utils';

export const BottomNav = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) => (
  <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-100 px-8 py-3 z-[90] flex justify-between items-center">
    {[
      { id: 'explore', icon: Compass, label: '探索' },
      { id: 'exhibition', icon: Library, label: '展陈' },
      { id: 'profile', icon: User, label: '我的' },
    ].map((item) => (
      <button
        key={item.id}
        onClick={() => setActiveTab(item.id)}
        className={cn(
          "flex flex-col items-center gap-1 transition-all duration-300",
          activeTab === item.id ? "text-primary scale-110" : "text-gray-400 hover:text-gray-600"
        )}
      >
        <item.icon size={24} strokeWidth={activeTab === item.id ? 2.5 : 2} />
        <span className="text-[10px] font-bold">{item.label}</span>
      </button>
    ))}
  </nav>
);
