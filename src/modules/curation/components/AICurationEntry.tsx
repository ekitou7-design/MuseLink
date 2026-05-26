import { Sparkles } from 'lucide-react';

export const AICurationEntry = ({ onOpen }: { onOpen: () => void }) => (
  <div className="space-y-4">
    <div className="flex items-center gap-2">
      <Sparkles size={20} className="text-amber-600 flex-shrink-0" />
      <h2 className="text-lg font-bold text-gray-900 force-nowrap">AI 智能策展</h2>
    </div>
    <div 
      className="rounded-[5px] p-6 border border-amber-100/50 flex flex-col space-y-4 text-center"
      style={{ backgroundColor: 'var(--tw-ring-offset-color)' }}
    >
      <p className="text-xs text-amber-700/70 leading-relaxed">
        输入一句话或直接语音描述，AI 将只基于后端文物库生成主题、展品、展览逻辑与文案。
      </p>
      <button 
        onClick={onOpen}
        className="w-full py-3 bg-amber-800 text-white rounded-[5px] text-xs font-bold shadow-lg shadow-amber-800/20 transition-all active:scale-95 force-nowrap"
      >
        立即生成
      </button>
    </div>
  </div>
);
