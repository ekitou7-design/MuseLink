import { cn } from '../../../lib/utils';

export const SearchOverlayTabs = ({
  searchOverlayTab,
  setSearchOverlayTab,
}: {
  searchOverlayTab: 'artifact' | 'exhibition' | 'museum' | 'user',
  setSearchOverlayTab: (tab: 'artifact' | 'exhibition' | 'museum' | 'user') => void,
}) => (
  <div className="flex border-b border-gray-100">
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
          'flex-1 py-4 text-sm font-bold transition-all',
          searchOverlayTab === id ? 'text-amber-800 border-b-2 border-amber-800' : 'text-gray-400',
        )}
      >
        {label}
      </button>
    ))}
  </div>
);
