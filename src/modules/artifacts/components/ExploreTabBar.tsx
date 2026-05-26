import { motion } from 'motion/react';
import { cn } from '../../../lib/utils';

export const ExploreTabBar = ({
  exploreTab,
  setExploreTab,
}: {
  exploreTab: string,
  setExploreTab: (tab: string) => void,
}) => (
  <div className="sticky top-[60px] z-40 bg-white/95 backdrop-blur-md py-2 px-4 border-b border-gray-100 shadow-sm h-[50px]">
    <div className="flex items-center gap-8 overflow-x-auto no-scrollbar py-1">
      {['推荐', '博物馆', '年代', '馆藏全览'].map((tab) => (
        <button
          key={tab}
          onClick={() => setExploreTab(tab)}
          className={cn(
            "relative py-2 text-sm font-medium transition-all flex-shrink-0 force-nowrap",
            exploreTab === tab ? "text-gray-900 font-bold" : "text-gray-400"
          )}
        >
          {tab}
          {exploreTab === tab && (
            <motion.div 
              layoutId="exploreTabUnderline"
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-amber-800 rounded-full"
            />
          )}
        </button>
      ))}
    </div>
  </div>
);
