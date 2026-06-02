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
  <div className="ios-tab-bar sticky top-[60px] z-30 px-5">
    <div className="ios-text-tabs no-scrollbar">
    {[
      { label: '收藏文物', count: favoriteArtifactsCount },
      { label: '我的展陈', count: myExhibitionsCount },
      { label: '收藏展陈', count: favExhibitionIdsCount }
    ].map((tab) => (
      <button
        key={tab.label}
        onClick={() => setProfileTab(tab.label)}
        className={cn(
          "ios-text-tab force-nowrap",
          profileTab === tab.label && "active"
        )}
      >
        <span>{tab.label}</span>
        <span className="ml-1 text-[11px] font-semibold opacity-45">({tab.count})</span>
        {profileTab === tab.label && <span className="ios-tab-indicator" />}
      </button>
    ))}
    </div>
  </div>
);
