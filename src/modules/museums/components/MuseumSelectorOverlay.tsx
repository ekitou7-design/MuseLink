import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Search } from 'lucide-react';
import { cn } from '../../../lib/utils';

export const MuseumSelectorOverlay = ({ 
  isOpen, 
  onClose, 
  museumsByProvince, 
  currentMuseum,
  museumCounts,
  onSelect 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  museumsByProvince: Record<string, string[]>, 
  currentMuseum: string,
  museumCounts: Record<string, number>,
  onSelect: (museum: string) => void 
}) => {
  const provinces = useMemo(() => Object.keys(museumsByProvince), [museumsByProvince]);
  const [tempProvince, setTempProvince] = useState('');
  const [tempMuseum, setTempMuseum] = useState('');
  const [museumSelectorQuery, setMuseumSelectorQuery] = useState('');

  const visibleMuseums = useMemo(() => {
    const q = museumSelectorQuery.trim().toLowerCase();
    const names = q
      ? Array.from(new Set(Object.values(museumsByProvince).flat()))
      : museumsByProvince[tempProvince] ?? [];
    return names
      .filter((name) => !q || name.toLowerCase().includes(q))
      .slice()
      .sort((a, b) => (museumCounts[b] ?? 0) - (museumCounts[a] ?? 0) || a.localeCompare(b, 'zh-CN'));
  }, [museumCounts, museumSelectorQuery, museumsByProvince, tempProvince]);

  // 仅在打开弹窗时初始化一次临时状态，避免后续操作被 useEffect 干扰重置
  useEffect(() => {
    if (isOpen) {
      const prov = provinces.find(p => museumsByProvince[p].includes(currentMuseum)) || provinces[0] || '';
      setTempProvince(prov);
      setTempMuseum(currentMuseum);
      setMuseumSelectorQuery('');
    }
  }, [isOpen]); // 移除 provinces 和 currentMuseum 依赖，只在打开时初始化

  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="fixed inset-0 bg-black/60 z-[200] flex flex-col justify-end"
    >
      <motion.div 
        initial={{ y: '100%' }} 
        animate={{ y: 0 }} 
        exit={{ y: '100%' }} 
        className="bg-white rounded-t-[32px] h-[85vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 pb-4 space-y-4 border-b border-gray-50">
          <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 -ml-2 text-gray-400 active:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-xl font-bold text-gray-900">选择博物馆</h2>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-gray-50 px-4 py-3">
            <Search size={16} className="text-gray-400 flex-shrink-0" />
            <input
              value={museumSelectorQuery}
              onChange={(event) => setMuseumSelectorQuery(event.target.value)}
              placeholder="搜索博物馆"
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-gray-700 outline-none placeholder:text-gray-300"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Provinces (30%) */}
          <div className="w-[30%] bg-gray-50 overflow-y-auto no-scrollbar py-2 border-r border-gray-100">
            {provinces.map(p => (
              <button
                key={p}
                onClick={() => {
                  setTempProvince(p);
                  // 切换省份时，默认选中该省第一个博物馆
                  if (museumsByProvince[p] && museumsByProvince[p].length > 0) {
                    setTempMuseum(museumsByProvince[p][0]);
                  }
                }}
                className={cn(
                  "w-full px-4 py-5 text-left transition-all relative",
                  tempProvince === p ? "bg-white text-blue-600 font-bold" : "text-gray-500 text-sm"
                )}
              >
                {tempProvince === p && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-blue-600 rounded-r-full" />
                )}
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate">{p}</span>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0",
                    tempProvince === p ? "bg-blue-50 text-blue-600" : "bg-gray-200 text-gray-400"
                  )}>
                    {museumsByProvince[p].length}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Right: Museums (70%) */}
          <div className="w-[70%] bg-white overflow-y-auto p-4 space-y-3">
            {visibleMuseums.map(m => (
              <button
                key={m}
                onClick={() => setTempMuseum(m)}
                className={cn(
                  "w-full p-4 rounded-2xl text-left transition-all border-2",
                  tempMuseum === m 
                    ? "bg-blue-50 border-blue-200 text-blue-700 font-bold shadow-sm" 
                    : "bg-gray-50 border-transparent text-gray-600 text-sm hover:bg-gray-100"
                )}
              >
                <span className="block break-words leading-snug">{m}</span>
                <span className={cn(
                  "mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold",
                  tempMuseum === m ? "bg-white text-blue-600" : "bg-white text-gray-400"
                )}>
                  {museumCounts[m] ?? 0} 件馆藏
                </span>
              </button>
            ))}
            {visibleMuseums.length === 0 && (
              <div className="py-20 text-center text-gray-300 text-sm italic">
                未找到匹配的博物馆
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-50 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
          <button
            onClick={() => {
              if (tempMuseum) {
                onSelect(tempMuseum);
                onClose();
              }
            }}
            disabled={!tempMuseum}
            className="w-full py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-100 active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale"
          >
            确定选择
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
