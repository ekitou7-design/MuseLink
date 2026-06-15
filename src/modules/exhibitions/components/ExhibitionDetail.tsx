import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronRight,
  LayoutGrid,
  Library,
  MessageCircle,
  Plus,
  Search,
  Settings,
  Share2,
  Sparkles,
  X,
} from 'lucide-react';
import { Artifact, Exhibition } from '../../../types';
import { rankArtifactsByKeywordQuery } from '../../../lib/artifactSearch';
import { cn } from '../../../lib/utils';
import { AmbientSoundControl } from '../../../components/AmbientSoundControl';
import { SafeImage } from '../../../components/SafeImage';
import {
  artifactDescriptionRaw,
  artifactEraRaw,
  artifactImageUrlRaw,
  artifactMuseumRaw,
  artifactNameRaw,
  displayDbString,
} from '../../../lib/dbDisplay';
import { ExhibitionShareModal } from './ExhibitionShareModal';
import {
  artifactRole,
  artifactSelectionReason,
  exhibitionConclusion,
  exhibitionGuideIntro,
  exhibitionTextSummary,
  normalizeExhibitionUnits,
} from '../lib/exhibitionUnits';

function tagName(tag: Artifact['tags'][number]) {
  return typeof tag === 'string' ? tag : tag.name;
}

function textValue(value: unknown) {
  return displayDbString(value);
}

function plainText(value: unknown) {
  return String(value ?? '').trim();
}

function findArtifactById(artifacts: Artifact[], id: string) {
  return artifacts.find((item) => item.id === id);
}

function CuratorPlanDrawer({
  isOpen,
  onClose,
  exhibition,
  artifacts,
  units,
}: {
  isOpen: boolean;
  onClose: () => void;
  exhibition: Exhibition;
  artifacts: Artifact[];
  units: ReturnType<typeof normalizeExhibitionUnits>;
}) {
  const aiCuration = exhibition.aiCuration;
  const guideIntro = exhibitionGuideIntro(exhibition);
  const conclusion = exhibitionConclusion(exhibition);
  const artifactIds = units.flatMap((unit) => unit.artifactIds);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.button
            type="button"
            aria-label="关闭 AI 策展方案"
            className="fixed inset-0 z-[150] bg-black/35"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed inset-x-0 bottom-0 z-[151] max-h-[82vh] overflow-hidden rounded-t-[28px] bg-[var(--app-page-bg)] shadow-2xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
          >
            <div className="mx-auto mt-3 h-1.5 w-11 rounded-full bg-gray-300" />
            <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">AI 策展方案</p>
                <h3 className="mt-1 truncate text-lg font-serif font-bold text-gray-950">
                  {aiCuration?.theme || exhibition.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm"
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[calc(82vh-84px)] space-y-5 overflow-y-auto px-5 pb-[max(24px,env(safe-area-inset-bottom,0px))] pt-5">
              {guideIntro && (
                <section className="rounded-2xl border border-amber-100 bg-white/80 p-4">
                  <h4 className="text-xs font-bold text-gray-900">展览导语</h4>
                  <p className="mt-2 break-words text-sm leading-relaxed text-gray-600">{guideIntro}</p>
                </section>
              )}

              {units.length > 0 && (
                <section className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">单元结构</h4>
                  {units.map((unit, index) => (
                    <div key={unit.id} className="rounded-2xl bg-white p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-black text-amber-800">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h5 className="break-words text-sm font-bold text-gray-950">{unit.title}</h5>
                          {unit.description && <p className="mt-1 break-words text-xs leading-relaxed text-gray-500">{unit.description}</p>}
                          {unit.curatorNote && <p className="mt-1 break-words text-[10px] leading-relaxed text-amber-800">{unit.curatorNote}</p>}
                          {unit.artifactIds.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {unit.artifactIds.map((id: string) => {
                                const artifact = findArtifactById(artifacts, id);
                                return (
                                  <span key={`${unit.id}-${id}`} className="max-w-full truncate rounded-full bg-[#F6F3EE] px-2.5 py-1 text-[10px] font-bold text-amber-900">
                                    {artifact ? textValue(artifactNameRaw(artifact)) : id}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </section>
              )}

              {artifactIds.length > 0 && (
                <section className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">展品策展理由</h4>
                  {artifactIds
                    .map((id: string) => {
                      const artifact = findArtifactById(artifacts, id);
                      if (!artifact) return null;
                      return (
                        <div key={`note-${id}`} className="rounded-2xl border border-gray-100 bg-white p-4">
                          <p className="text-xs font-bold text-amber-900">{textValue(artifactNameRaw(artifact))}</p>
                          <p className="mt-1 break-words text-xs leading-relaxed text-gray-500">{artifactSelectionReason(exhibition, artifact)}</p>
                        </div>
                      );
                    })}
                </section>
              )}

              {conclusion && (
                <section className="rounded-2xl bg-[#F8F5EF] p-4">
                  <h4 className="text-xs font-bold text-gray-900">结语</h4>
                  <p className="mt-2 break-words text-sm leading-relaxed text-gray-600">{conclusion}</p>
                </section>
              )}

              {aiCuration?.sourceNote && (
                <p className="break-words border-t border-amber-100 pt-4 text-[10px] leading-relaxed text-amber-800">
                  {aiCuration.sourceNote}
                </p>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function ExhibitionArtifactRow({
  artifact,
  index,
  isSelected,
  isMultiSelect,
  reason,
  role,
  onClick,
}: {
  artifact: Artifact;
  index: number;
  isSelected: boolean;
  isMultiSelect: boolean;
  reason: string;
  role: string;
  onClick: () => void;
}) {
  const tags = (artifact.tags || []).map(tagName).filter(Boolean).slice(0, 3);
  const description = textValue(artifactDescriptionRaw(artifact));

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full gap-3 rounded-2xl border bg-white p-3 text-left shadow-sm transition-all active:scale-[0.99]",
        isSelected ? "border-amber-700 ring-2 ring-amber-100" : "border-gray-100",
      )}
    >
      <SafeImage
        src={String(artifactImageUrlRaw(artifact, "thumbnail") ?? "")}
        alt={textValue(artifactNameRaw(artifact))}
        width={80}
        height={80}
        className="h-20 w-20 shrink-0 rounded-2xl bg-gray-100 object-cover"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0 font-serif text-[11px] font-bold text-amber-700">
            {String(index + 1).padStart(2, '0')}
          </span>
          <h5 className="line-clamp-2 min-w-0 text-sm font-black leading-snug text-gray-950">
            {textValue(artifactNameRaw(artifact))}
          </h5>
        </div>
        <p className="mt-1 line-clamp-1 text-[11px] font-medium text-gray-500">
          {textValue(artifactEraRaw(artifact))} / {textValue(artifactMuseumRaw(artifact))}
        </p>
        <p className="mt-1 line-clamp-1 text-[11px] leading-relaxed text-gray-400">{description}</p>
        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-amber-800">{reason}</p>
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-800">{role}</span>
            {tags.map((tag) => (
              <span key={tag} className="max-w-[7rem] truncate rounded-full bg-[#F6F3EE] px-2 py-0.5 text-[9px] font-bold text-primary">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      {isMultiSelect && (
        <span
          className={cn(
            "mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all",
            isSelected ? "border-amber-800 bg-amber-800 text-white" : "border-gray-200 bg-white text-transparent",
          )}
        >
          <Check size={14} />
        </span>
      )}
    </button>
  );
}

export const ExhibitionDetail = ({ 
  exhibition, 
  onClose, 
  onArtifactClick, 
  artifacts,
  isFavorite, 
  toggleFavorite,
  user,
  onEdit,
  onSlideshowOpen
}: any) => {
  const [search, setSearch] = useState('');
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isPlanOpen, setIsPlanOpen] = useState(false);
  const artifactIds = useMemo(
    () => Array.isArray(exhibition.artifactIds) ? exhibition.artifactIds : [],
    [exhibition.artifactIds],
  );

  const isOwner = Boolean(user && String(exhibition.userId) === String(user.id));
  const aiCuration = (exhibition as Exhibition).aiCuration;
  const units = useMemo(() => normalizeExhibitionUnits(exhibition as Exhibition), [exhibition]);
  const guideIntro = exhibitionGuideIntro(exhibition as Exhibition);
  const exhibitIntro = plainText((exhibition as Exhibition).exhibitionIntro) || plainText(exhibition.intro);
  const conclusion = exhibitionConclusion(exhibition as Exhibition);
  const planSummary = guideIntro ? exhibitionTextSummary(guideIntro, 96) : '查看展览的叙事结构、单元安排和展品选择理由。';

  const filteredArtifactIds = useMemo(() => {
    if (!search.trim()) return artifactIds;
    const items = artifactIds
      .map((id: string) => artifacts.find((art: Artifact) => art.id === id))
      .filter(Boolean) as Artifact[];
    return rankArtifactsByKeywordQuery(items, search).map((a) => a.id);
  }, [artifactIds, artifacts, search]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const visibleUnits = useMemo(() => {
    const visible = new Set(filteredArtifactIds);
    return units
      .map((unit) => ({
        ...unit,
        artifactIds: unit.artifactIds.filter((id) => visible.has(id)),
      }))
      .filter((unit) => unit.artifactIds.length > 0);
  }, [filteredArtifactIds, units]);

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="fixed inset-0 z-[110] flex flex-col overflow-y-auto bg-[var(--app-page-bg)] no-scrollbar"
      style={{ top: 'var(--app-status-bar-height)' }}
    >
      {/* Header Area (Playlist Style) */}
      <div className="relative h-[45vh] flex-shrink-0">
        {exhibition.coverUrl && (
          <img src={exhibition.coverUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        
        <div className="absolute top-6 left-0 right-0 px-4 sm:px-6 flex items-center justify-between gap-3">
          <button onClick={onClose} className="p-2 bg-black/20 backdrop-blur-md rounded-full text-white flex-shrink-0"><ArrowLeft size={20} /></button>
          <div className="min-w-0 flex items-center justify-end gap-2">
            <button 
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSlideshowOpen(exhibition);
              }}
              className="flex min-w-0 max-w-[calc(100%-5.5rem)] items-center justify-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold text-black shadow-lg shadow-black/20 backdrop-blur-md active:scale-95 sm:px-4 force-nowrap"
            >
              <Sparkles size={20} className="flex-shrink-0" />
              <span className="force-nowrap">进入沉浸展览</span>
            </button>
            <button
              type="button"
              onClick={() => setIsShareOpen(true)}
              className="p-2 bg-black/20 backdrop-blur-md rounded-full text-white"
            >
              <Share2 size={20} />
            </button>
            <AmbientSoundControl triggerClassName="h-10 w-10 bg-black/20 text-white backdrop-blur-md" />
          </div>
        </div>

        <div className="absolute bottom-10 left-6 right-6 flex gap-6 items-end">
          <div className="w-32 h-32 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 border-2 border-white/20">
            {exhibition.coverUrl && (
              <img src={exhibition.coverUrl} className="w-full h-full object-cover" />
            )}
          </div>
          <div className="flex-1 text-white space-y-3">
            <h2 className="text-2xl font-bold leading-tight">{exhibition.title}</h2>
            <div className="flex items-center gap-2">
              {exhibition.userPhoto && (
                <img src={exhibition.userPhoto} className="w-6 h-6 rounded-full border border-white/20" />
              )}
              <span className="text-xs font-bold opacity-90">{exhibition.userName}</span>
              <ChevronRight size={20} className="opacity-50" />
            </div>
            <p className="line-clamp-2 break-words text-[10px] leading-relaxed opacity-70">
              {exhibitIntro ? exhibitionTextSummary(exhibitIntro, 120) : exhibitionTextSummary(guideIntro, 120)}
            </p>
          </div>
        </div>
      </div>

      {/* Interaction Bar */}
      <div className="px-6 py-4 flex items-center justify-around border-b border-gray-50">
        <button
          type="button"
          onClick={() => setIsShareOpen(true)}
          className="flex flex-col items-center gap-1 text-gray-500"
        >
          <Share2 size={20} />
          <span className="text-[10px] font-bold">转发</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-gray-500">
          <MessageCircle size={20} />
          <span className="text-[10px] font-bold">{exhibition.commentsCount || '评论'}</span>
        </button>
        <button 
          onClick={toggleFavorite}
          className={cn("flex flex-col items-center gap-1", isFavorite ? "text-primary" : "text-gray-500")}
        >
          {isFavorite ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
          <span className="text-[10px] font-bold">{isFavorite ? '已收藏' : '收藏'}</span>
        </button>
        {isOwner && (
          <button 
            onClick={onEdit}
            className="flex flex-col items-center gap-1 text-primary"
          >
            <Settings size={20} />
            <span className="text-[10px] font-bold">编辑</span>
          </button>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 p-6 space-y-6">
        {exhibitIntro && exhibitIntro !== guideIntro && (
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">展览介绍</p>
            <p className="mt-2 break-words text-sm leading-relaxed text-gray-600">{exhibitIntro}</p>
          </section>
        )}

        {guideIntro && (
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-amber-700">展览前言</p>
            <p className="break-words text-sm leading-relaxed text-gray-600">{guideIntro}</p>
          </section>
        )}

        {(aiCuration || units.length > 0) && (
          <button
            type="button"
            onClick={() => setIsPlanOpen(true)}
            className="flex w-full items-center gap-3 rounded-2xl border border-amber-100 bg-[#FBF7EE] p-4 text-left shadow-sm transition-all active:scale-[0.99]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800">
              <Sparkles size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black text-gray-950">{aiCuration ? '查看 AI 策展方案' : '查看展览结构'}</span>
              <span className="mt-1 line-clamp-2 block break-words text-xs leading-relaxed text-gray-500">{planSummary}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-amber-800">
              查看
              <ChevronRight size={16} />
            </span>
          </button>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Library size={20} className="text-amber-800" />
            <h4 className="text-sm font-bold text-gray-900">展品清单 ({artifactIds.length})</h4>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMultiSelect(!isMultiSelect)}
              className={cn("p-2 rounded-xl transition-all", isMultiSelect ? "bg-amber-800 text-white" : "bg-gray-100 text-gray-500")}
            >
              <LayoutGrid size={20} />
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索展陈内的文物..." 
            className="w-full bg-gray-50 border-none rounded-xl py-2 pl-10 pr-4 text-xs" 
          />
        </div>

        <div className="space-y-6">
          {visibleUnits.map((unit, unitIndex) => (
            <section key={unit.id} className="space-y-3">
              <div className="rounded-2xl border border-gray-100 bg-white/70 p-4">
                <p className="font-serif text-[11px] font-bold text-amber-700">第 {unitIndex + 1} 单元</p>
                <h5 className="mt-1 break-words text-lg font-serif font-bold text-gray-950">{unit.title}</h5>
                <p className="mt-2 line-clamp-2 break-words text-xs leading-relaxed text-gray-500">{unit.description}</p>
              </div>
              <div className="space-y-3">
                {unit.artifactIds.map((id: string) => {
                  const artifact = artifacts.find((a: Artifact) => a.id === id);
                  if (!artifact) return null;
                  const isSelected = selectedIds.includes(id);
                  return (
                    <ExhibitionArtifactRow
                      key={`exh-detail-art-${unit.id}-${id}`}
                      artifact={artifact}
                      index={artifactIds.indexOf(id)}
                      isSelected={isSelected}
                      isMultiSelect={isMultiSelect}
                      reason={artifactSelectionReason(exhibition as Exhibition, artifact)}
                      role={artifactRole(exhibition as Exhibition, artifact)}
                      onClick={() => isMultiSelect ? toggleSelect(id) : onArtifactClick(artifact)}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {filteredArtifactIds.length === 0 && (
          <div className="py-16 text-center text-gray-300 text-xs italic">
            {artifactIds.length === 0 ? '这个展览暂时还没有添加文物' : '没有找到匹配的展品'}
          </div>
        )}

        {conclusion && (
          <section className="rounded-2xl bg-[#F8F5EF] p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">策展结语</p>
            <p className="mt-2 break-words text-sm leading-relaxed text-gray-700">{conclusion}</p>
          </section>
        )}

        {isMultiSelect && selectedIds.length > 0 && (
          <div className="fixed bottom-24 left-6 right-6 bg-white border border-gray-100 shadow-2xl rounded-2xl p-4 flex items-center justify-between z-[120]">
            <span className="text-xs font-bold text-gray-600">已选择 {selectedIds.length} 项</span>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-[10px] font-bold">加入收藏</button>
              {isOwner && (
                <button className="px-4 py-2 bg-rose-50 text-rose-500 rounded-xl text-[10px] font-bold">从展陈移除</button>
              )}
            </div>
          </div>
        )}

      </div>

      <ExhibitionShareModal
        isOpen={isShareOpen}
        exhibition={exhibition}
        onClose={() => setIsShareOpen(false)}
      />
      <CuratorPlanDrawer
        isOpen={isPlanOpen}
        onClose={() => setIsPlanOpen(false)}
        exhibition={exhibition as Exhibition}
        artifacts={artifacts}
        units={units}
      />
    </motion.div>
  );
};
