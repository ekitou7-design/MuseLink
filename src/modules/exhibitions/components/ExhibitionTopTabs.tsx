import { Globe, Library, Sparkles } from 'lucide-react';
import { cn } from '../../../lib/utils';

export type ExhibitionView = 'ai' | 'mine' | 'square';

export const ExhibitionTopTabs = ({
  value,
  onChange,
}: {
  value: ExhibitionView;
  onChange: (value: ExhibitionView) => void;
}) => {
  const tabs = [
    { id: 'ai' as const, label: 'AI 策展', icon: Sparkles },
    { id: 'mine' as const, label: '我的策展', icon: Library },
    { id: 'square' as const, label: '展陈广场', icon: Globe },
  ];

  return (
    <div className="sticky top-[60px] z-40 border-b border-gray-100 bg-white/95 px-3 py-2 backdrop-blur-md">
      <div className="grid grid-cols-3 gap-1.5 rounded-[5px] bg-gray-100 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex min-h-9 items-center justify-center gap-1 rounded-[5px] text-[11px] font-bold transition-all',
              value === tab.id ? 'bg-white text-amber-800 shadow-sm' : 'text-gray-500',
            )}
          >
            <tab.icon size={14} />
            <span className="force-nowrap">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
