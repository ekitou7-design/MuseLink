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
    <div className="ios-tab-bar sticky top-[60px] z-40 flex items-center px-5">
      <div className="ios-segment-tabs grid w-full grid-cols-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex items-center justify-center gap-1 rounded-full text-[12px] font-bold transition-all',
              value === tab.id ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500',
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
