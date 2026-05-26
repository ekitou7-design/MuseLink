import { Bookmark, Heart, Library } from 'lucide-react';
import { cn } from '../../../lib/utils';

export const ProfileTabBar = ({
  profileTab,
  setProfileTab,
  favoriteArtifactsCount,
  myExhibitionsCount,
  favExhibitionIdsCount,
}: {
  profileTab: string,
  setProfileTab: (tab: string) => void,
  favoriteArtifactsCount: number,
  myExhibitionsCount: number,
  favExhibitionIdsCount: number,
}) => (
  <div className="sticky top-[60px] z-30 bg-white flex border-b border-gray-100">
    {[
      { label: '收藏文物', icon: Heart, count: favoriteArtifactsCount },
      { label: '我的展陈', icon: Library, count: myExhibitionsCount },
      { label: '收藏展陈', icon: Bookmark, count: favExhibitionIdsCount }
    ].map((tab) => (
      <button
        key={tab.label}
        onClick={() => setProfileTab(tab.label)}
        className={cn(
          "flex-1 py-4 text-xs font-bold transition-all relative flex flex-col items-center justify-center gap-1 force-nowrap",
          profileTab === tab.label ? "text-amber-800" : "text-gray-400"
        )}
      >
        <tab.icon size={18} strokeWidth={profileTab === tab.label ? 2.5 : 2} />
        <div className="flex items-center gap-1 force-nowrap">
          {tab.label}
          <span className="text-[10px] opacity-50 font-medium force-nowrap">({tab.count})</span>
        </div>
        {profileTab === tab.label && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-1 bg-amber-800 rounded-full" />}
      </button>
    ))}
  </div>
);
