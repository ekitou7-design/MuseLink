import { motion } from 'motion/react';
import { cn } from '../../../lib/utils';

export const ExploreTabBar = ({
  exploreTab,
  setExploreTab,
}: {
  exploreTab: string,
  setExploreTab: (tab: string) => void,
}) => (
  <div className="ios-tab-bar sticky top-[60px] z-40 px-5">
    <div className="ios-text-tabs no-scrollbar">
      {['推荐', '博物馆', '年代', '馆藏全览'].map((tab) => (
        <button
          key={tab}
          onClick={() => setExploreTab(tab)}
          className={cn(
            "ios-text-tab force-nowrap",
            exploreTab === tab && "active"
          )}
        >
          {tab}
          {exploreTab === tab && (
            <motion.div 
              layoutId="exploreTabUnderline"
              className="ios-tab-indicator"
            />
          )}
        </button>
      ))}
    </div>
  </div>
);
