import { ArrowLeft, Loader2, Search, User } from 'lucide-react';
import { motion } from 'motion/react';
import { Artifact, Exhibition, Museum } from '../../../types';
import { cn } from '../../../lib/utils';
import { ArtifactCard } from '../../artifacts/components/ArtifactCard';
import { ExhibitionCard } from '../../exhibitions/components/ExhibitionCard';
import { SearchOverlayTabs } from './SearchOverlayTabs';

export const SearchOverlay = ({
  setIsSearching,
  executeRelicSearch,
  searchQuery,
  setSearchQuery,
  relicSearchLoading,
  searchOverlayTab,
  setSearchOverlayTab,
  relicSearchError,
  lastRelicSearchKeyword,
  searchArtifactResults,
  setSelectedArtifact,
  addToHistory,
  searchExhibitionResults,
  setSelectedExhibition,
  searchMuseumResults,
  setExploreTab,
  setMuseumSubTab,
  setResourceView,
}: {
  setIsSearching: (value: boolean) => void,
  executeRelicSearch: () => void,
  searchQuery: string,
  setSearchQuery: (value: string) => void,
  relicSearchLoading: boolean,
  searchOverlayTab: 'artifact' | 'exhibition' | 'museum' | 'user',
  setSearchOverlayTab: (tab: 'artifact' | 'exhibition' | 'museum' | 'user') => void,
  relicSearchError: string,
  lastRelicSearchKeyword: string,
  searchArtifactResults: Artifact[],
  setSelectedArtifact: (artifact: Artifact) => void,
  addToHistory: (id: string) => void,
  searchExhibitionResults: Exhibition[],
  setSelectedExhibition: (exhibition: Exhibition) => void,
  searchMuseumResults: Museum[],
  setExploreTab: (tab: string) => void,
  setMuseumSubTab: (museum: string) => void,
  setResourceView: (view: 'overview' | 'artifacts' | 'museums' | 'eras' | 'collections' | 'types' | 'materials' | 'tags') => void,
}) => (
  <motion.div
    key="searching-overlay"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-x-0 bottom-0 z-[100] flex flex-col bg-[var(--app-page-bg)]"
    style={{ top: 'var(--phone-safe-top)' }}
  >
    <div className="ios-title-bar flex items-center gap-3 border-b border-black/5 bg-[var(--app-bar-bg)] px-5 backdrop-blur-xl">
      <button onClick={() => setIsSearching(false)} className="flex h-10 w-10 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100"><ArrowLeft size={24} /></button>
      <form
        className="flex-1 relative"
        onSubmit={(event) => {
          event.preventDefault();
          executeRelicSearch();
        }}
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={16} />
        <input
          autoFocus
          type="text"
          placeholder="搜索文物、展陈、博物馆、用户"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="ios-input h-11 w-full border-none py-0 pl-11 pr-4 text-[15px] leading-[44px] outline-none placeholder:leading-[44px]"
        />
        {relicSearchLoading ? (
          <Loader2
            size={16}
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-amber-800"
          />
        ) : null}
      </form>
    </div>
    <SearchOverlayTabs
      searchOverlayTab={searchOverlayTab}
      setSearchOverlayTab={setSearchOverlayTab}
    />
    <div className="flex-1 overflow-y-auto p-5">
      {!searchQuery.trim() ? (
        <div className="flex flex-col items-center justify-center text-gray-300 space-y-4 py-20">
          <Search size={64} strokeWidth={1} />
          <p className={cn("text-sm font-medium", relicSearchError ? "text-amber-800" : undefined)}>
            {relicSearchError || '输入关键词开始探索'}
          </p>
          <p className="text-[10px] text-gray-400 text-center max-w-xs leading-relaxed">
            文物检索覆盖名称、博物馆、年代、材质、文化、出土地、标签与简介；多个词可同时输入。
          </p>
        </div>
      ) : searchOverlayTab === 'artifact' ? (
        relicSearchLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-400">
            <Loader2 size={28} className="animate-spin text-amber-800" />
            <p className="text-sm font-medium">正在搜索文物...</p>
          </div>
        ) : relicSearchError && lastRelicSearchKeyword === searchQuery.trim() ? (
          <p className="text-center text-sm text-amber-800 py-16">{relicSearchError}</p>
        ) : lastRelicSearchKeyword !== searchQuery.trim() ? (
          <div className="flex flex-col items-center justify-center text-gray-300 space-y-4 py-20">
            <Search size={48} strokeWidth={1} />
            <p className="text-sm font-medium">按回车搜索文物</p>
          </div>
        ) : searchArtifactResults.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-16">暂无相关文物</p>
        ) : (
          <div className="columns-2 gap-3">
            {searchArtifactResults.map((artifact) => (
              <div key={artifact.id} className="break-inside-avoid">
                <ArtifactCard
                  artifact={artifact}
                  onClick={() => {
                    setSelectedArtifact(artifact);
                    addToHistory(artifact.id);
                    setIsSearching(false);
                  }}
                />
              </div>
            ))}
          </div>
        )
      ) : searchOverlayTab === 'exhibition' ? (
        searchExhibitionResults.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-16">未找到相关展陈</p>
        ) : (
          <div className="columns-2 gap-2">
            {searchExhibitionResults.map((exhibition) => (
              <div key={exhibition.id} className="break-inside-avoid mb-2">
                <ExhibitionCard
                  exhibition={exhibition}
                  onClick={() => {
                    setSelectedExhibition(exhibition);
                    setIsSearching(false);
                  }}
                />
              </div>
            ))}
          </div>
        )
      ) : searchOverlayTab === 'museum' ? (
        searchMuseumResults.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-16">未找到匹配的博物馆</p>
        ) : (
          <div className="space-y-2">
            {searchMuseumResults.map((museum) => (
              <button
                key={museum.id || museum.name}
                type="button"
                onClick={() => {
                  setExploreTab('文博资料');
                  setResourceView('museums');
                  setMuseumSubTab(museum.name);
                  setIsSearching(false);
                  setSearchQuery('');
                }}
                className="w-full text-left px-4 py-3 rounded-xl bg-gray-50 active:bg-gray-100"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="break-words text-sm font-bold text-gray-800">{museum.name}</span>
                  <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap">
                    {museum.artifactCount} 件
                  </span>
                </div>
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center text-gray-300 py-20">
          <User size={48} strokeWidth={1} />
          <p className="text-sm font-medium mt-4">用户搜索暂未开放</p>
        </div>
      )}
    </div>
  </motion.div>
);
