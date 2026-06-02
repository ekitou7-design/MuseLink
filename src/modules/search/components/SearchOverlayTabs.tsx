import { cn } from '../../../lib/utils';

export const SearchOverlayTabs = ({
  searchOverlayTab,
  setSearchOverlayTab,
}: {
  searchOverlayTab: 'artifact' | 'exhibition' | 'museum' | 'user',
  setSearchOverlayTab: (tab: 'artifact' | 'exhibition' | 'museum' | 'user') => void,
}) => (
  <div className="ios-tab-bar px-5">
    <div className="ios-text-tabs no-scrollbar">
    {([
      { id: 'artifact' as const, label: '文物' },
      { id: 'exhibition' as const, label: '展陈' },
      { id: 'museum' as const, label: '博物馆' },
      { id: 'user' as const, label: '用户' },
    ]).map(({ id, label }) => (
      <button
        key={id}
        type="button"
        onClick={() => setSearchOverlayTab(id)}
        className={cn(
          'ios-text-tab force-nowrap',
          searchOverlayTab === id && 'active',
        )}
      >
        {label}
        {searchOverlayTab === id && (
          <span className="ios-tab-indicator" />
        )}
      </button>
    ))}
    </div>
  </div>
);
