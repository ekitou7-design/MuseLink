import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Library, Music, Play, Plus, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Artifact, Exhibition, ExhibitionArtifactRole, ExhibitionUnit, SlideshowSettings } from '../../../types';
import { artifactNameRaw, displayDbString } from '../../../lib/dbDisplay';
import { cn } from '../../../lib/utils';
import { normalizeExhibitionUnits } from '../lib/exhibitionUnits';
import { DEFAULT_EXHIBITION_COVER } from '../constants/covers';
import { ExhibitionCoverPicker } from './ExhibitionCoverPicker';

type EditorTab = 'basic' | 'guide' | 'units' | 'artifacts';

const ROLE_OPTIONS: ExhibitionArtifactRole[] = ['核心展品', '补充展品', '过渡展品', '对比展品'];

function asText(value: unknown) {
  return String(value ?? '').trim();
}

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids.map(String).map(id => id.trim()).filter(Boolean)));
}

function artifactLabel(artifact: Artifact | undefined, id: string) {
  if (!artifact) return `文物 ${id}`;
  return displayDbString(artifactNameRaw(artifact)) || `文物 ${id}`;
}

function normalizeEditableUnits(exhibition: Exhibition): ExhibitionUnit[] {
  const exhibitionIds = uniqueIds(Array.isArray(exhibition.artifactIds) ? exhibition.artifactIds : []);
  const sourceUnits = Array.isArray(exhibition.units) && exhibition.units.length > 0
    ? exhibition.units
    : normalizeExhibitionUnits(exhibition);
  const seen = new Set<string>();
  const units = sourceUnits.map((unit, index) => {
    const artifactIds = uniqueIds(Array.isArray(unit.artifactIds) ? unit.artifactIds : [])
      .filter((id) => {
        if (!exhibitionIds.includes(id) || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    return {
      id: asText(unit.id) || `unit-${index + 1}`,
      title: asText(unit.title) || `第 ${index + 1} 单元`,
      description: asText(unit.description),
      artifactIds,
      curatorNote: asText(unit.curatorNote),
    };
  });
  const missingIds = exhibitionIds.filter(id => !seen.has(id));
  if (units.length === 0) {
    return [{
      id: 'default',
      title: '精选展品',
      description: '本单元汇集本展览中的代表性展品。',
      artifactIds: missingIds,
      curatorNote: '',
    }];
  }
  if (missingIds.length > 0) {
    units[0] = { ...units[0], artifactIds: [...units[0].artifactIds, ...missingIds] };
  }
  return units;
}

function cleanUnits(units: ExhibitionUnit[], allowedIds: string[]) {
  const allowed = new Set(allowedIds);
  const seen = new Set<string>();
  return units.map((unit, index) => {
    const artifactIds = uniqueIds(unit.artifactIds).filter((id) => {
      if (!allowed.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    return {
      id: asText(unit.id) || `unit-${index + 1}`,
      title: asText(unit.title) || `第 ${index + 1} 单元`,
      description: asText(unit.description),
      artifactIds,
      curatorNote: asText(unit.curatorNote),
    };
  });
}

export const EditExhibitionModal = ({
  isOpen,
  onClose,
  exhibition,
  artifacts,
  onUpdate,
  onDelete,
  onManageArtifacts,
  onSlideshowPreview,
  onBGMGenerate
}: {
  isOpen: boolean,
  onClose: () => void,
  exhibition: Exhibition | null,
  artifacts: Artifact[],
  onUpdate: (updated: Partial<Exhibition>) => void,
  onDelete: (id: string) => void,
  onManageArtifacts: () => void,
  onSlideshowPreview: () => void,
  onBGMGenerate: () => void
}) => {
  const [activeTab, setActiveTab] = useState<EditorTab>('basic');
  const [title, setTitle] = useState('');
  const [exhibitionIntro, setExhibitionIntro] = useState('');
  const [opening, setOpening] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [bgmUrl, setBgmUrl] = useState('');
  const [units, setUnits] = useState<ExhibitionUnit[]>([]);
  const [selectionReasons, setSelectionReasons] = useState<Record<string, string>>({});
  const [artifactRoles, setArtifactRoles] = useState<Record<string, ExhibitionArtifactRole>>({});
  const [slideshowSettings, setSlideshowSettings] = useState<SlideshowSettings>({
    duration: 4,
    transition: 'fade',
    showIntro: true,
    loop: true
  });

  const artifactMap = useMemo(() => new Map(artifacts.map(item => [String(item.id), item])), [artifacts]);
  const exhibitionArtifactIds = useMemo(
    () => uniqueIds(Array.isArray(exhibition?.artifactIds) ? exhibition.artifactIds : []),
    [exhibition?.artifactIds],
  );

  useEffect(() => {
    if (exhibition) {
      setActiveTab('basic');
      setTitle(exhibition.title);
      setExhibitionIntro(exhibition.exhibitionIntro || exhibition.intro || '');
      setOpening(exhibition.aiCuration?.opening || '');
      setConclusion(exhibition.conclusion || exhibition.aiCuration?.ending || '');
      setCoverUrl(exhibition.coverUrl || DEFAULT_EXHIBITION_COVER);
      setBgmUrl(exhibition.bgmUrl || '');
      setUnits(normalizeEditableUnits(exhibition));
      setSelectionReasons({
        ...(exhibition.aiCuration?.artifactNotes || {}),
        ...(exhibition.selectionReasons || {}),
      });
      setArtifactRoles({ ...(exhibition.artifactRoles || {}) });
      setSlideshowSettings({
        duration: exhibition.slideshowSettings?.duration ?? 4,
        transition: exhibition.slideshowSettings?.transition ?? 'fade',
        showIntro: exhibition.slideshowSettings?.showIntro ?? true,
        loop: exhibition.slideshowSettings?.loop ?? true,
      });
    }
  }, [exhibition]);

  if (!exhibition) return null;

  const updateUnit = (unitId: string, patch: Partial<ExhibitionUnit>) => {
    setUnits(prev => prev.map(unit => unit.id === unitId ? { ...unit, ...patch } : unit));
  };

  const addUnit = () => {
    setUnits(prev => [
      ...prev,
      {
        id: `unit-${Date.now()}`,
        title: `第 ${prev.length + 1} 单元`,
        description: '',
        artifactIds: [],
        curatorNote: '',
      },
    ]);
  };

  const removeUnit = (unitId: string) => {
    setUnits(prev => {
      const removed = prev.find(unit => unit.id === unitId);
      const rest = prev.filter(unit => unit.id !== unitId);
      if (!removed || rest.length === 0) return rest;
      return rest.map((unit, index) => index === 0 ? { ...unit, artifactIds: [...unit.artifactIds, ...removed.artifactIds] } : unit);
    });
  };

  const moveArtifactWithinUnit = (unitId: string, artifactId: string, direction: -1 | 1) => {
    setUnits(prev => prev.map(unit => {
      if (unit.id !== unitId) return unit;
      const index = unit.artifactIds.indexOf(artifactId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= unit.artifactIds.length) return unit;
      const nextIds = [...unit.artifactIds];
      [nextIds[index], nextIds[nextIndex]] = [nextIds[nextIndex], nextIds[index]];
      return { ...unit, artifactIds: nextIds };
    }));
  };

  const moveArtifactToUnit = (artifactId: string, nextUnitId: string) => {
    setUnits(prev => prev.map(unit => {
      const withoutArtifact = unit.artifactIds.filter(id => id !== artifactId);
      if (unit.id === nextUnitId) return { ...unit, artifactIds: [...withoutArtifact, artifactId] };
      return { ...unit, artifactIds: withoutArtifact };
    }));
  };

  const save = () => {
    const normalizedUnits = cleanUnits(units, exhibitionArtifactIds);
    const orderedIds = [
      ...normalizedUnits.flatMap(unit => unit.artifactIds),
      ...exhibitionArtifactIds.filter(id => !normalizedUnits.some(unit => unit.artifactIds.includes(id))),
    ];
    const cleanReasons = Object.fromEntries(
      exhibitionArtifactIds.map(id => [id, asText(selectionReasons[id])]).filter(([, value]) => value),
    );
    const cleanRoles = Object.fromEntries(
      exhibitionArtifactIds
        .map(id => [id, artifactRoles[id]] as const)
        .filter(([, value]) => ROLE_OPTIONS.includes(value)),
    ) as Record<string, ExhibitionArtifactRole>;
    const nextAiCuration = {
      ...(exhibition.aiCuration || {}),
      theme: title,
      opening: asText(opening),
      sections: normalizedUnits.map(unit => ({
        title: unit.title,
        summary: unit.curatorNote || unit.description,
        artifactIds: unit.artifactIds,
      })),
      artifactNotes: {
        ...(exhibition.aiCuration?.artifactNotes || {}),
        ...cleanReasons,
      },
      ending: asText(conclusion),
    };
    onUpdate({
      title,
      intro: exhibitionIntro,
      exhibitionIntro,
      coverUrl: coverUrl || DEFAULT_EXHIBITION_COVER,
      bgmUrl,
      slideshowSettings,
      artifactIds: orderedIds,
      units: normalizedUnits,
      conclusion,
      selectionReasons: cleanReasons,
      artifactRoles: cleanRoles,
      aiCuration: nextAiCuration,
    });
  };

  const tabs: Array<{ id: EditorTab; label: string }> = [
    { id: 'basic', label: '基本信息' },
    { id: 'guide', label: '前言结语' },
    { id: 'units', label: '单元结构' },
    { id: 'artifacts', label: '展品说明' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          className="fixed inset-0 z-[200] bg-white flex flex-col"
        >
          <div className="p-4 flex items-center justify-between border-b border-gray-100">
            <button onClick={onClose} className="p-2 text-gray-400"><X size={20} /></button>
            <h2 className="text-lg font-serif font-bold">编辑展陈信息</h2>
            <button
              onClick={save}
              className="px-4 py-1.5 bg-primary text-white rounded-full text-xs font-bold"
            >
              保存
            </button>
          </div>

          <div className="border-b border-gray-100 px-4 py-3">
            <div className="grid grid-cols-4 gap-2 rounded-2xl bg-gray-50 p-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "rounded-xl px-2 py-2 text-[10px] font-bold transition-all force-nowrap",
                    activeTab === tab.id ? "bg-white text-primary shadow-sm" : "text-gray-400",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
            {activeTab === 'basic' && (
              <>
                <div className="flex items-center gap-3">
                  <button
                    onClick={onSlideshowPreview}
                    className="flex-1 py-3 bg-primary/10 text-primary rounded-2xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-primary/20 transition-all force-nowrap"
                  >
                    <Play size={20} fill="currentColor" />
                    幻灯片预览
                  </button>
                  <button
                    onClick={onBGMGenerate}
                    className="flex-1 py-3 bg-secondary/5 text-secondary rounded-2xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-secondary/10 transition-all force-nowrap"
                  >
                    <Music size={20} />
                    AI 生成 BGM
                  </button>
                </div>

                <div className="space-y-6">
                  <ExhibitionCoverPicker value={coverUrl || DEFAULT_EXHIBITION_COVER} onChange={setCoverUrl} />
                  <div className="flex-1 space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">展陈标题</label>
                      <input
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="给展陈起个名字"
                        className="w-full bg-transparent border-b border-gray-100 focus:border-primary transition-colors py-2 text-lg font-serif font-bold outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">展览介绍</label>
                      <textarea
                        value={exhibitionIntro}
                        onChange={e => setExhibitionIntro(e.target.value)}
                        placeholder="写给观众看的展览介绍..."
                        className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-3 text-sm min-h-[120px] outline-none resize-none text-gray-600 focus:border-primary"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">BGM URL</label>
                      <input
                        value={bgmUrl}
                        onChange={e => setBgmUrl(e.target.value)}
                        placeholder="可填写背景音乐链接"
                        className="w-full rounded-xl border border-gray-100 bg-white px-3 py-2 text-xs outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-50">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">幻灯片播放设置</h3>
                  <div className="bg-neutral rounded-3xl p-6 space-y-6 border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-secondary force-nowrap">自动播放间隔</h4>
                        <p className="text-[10px] text-gray-400">设置每张幻灯片停留时间</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setSlideshowSettings(prev => ({ ...prev, duration: Math.max(2, prev.duration - 1) }))}
                          className="w-8 h-8 rounded-full bg-white border border-gray-100 flex items-center justify-center text-secondary hover:bg-gray-50"
                        >
                          -
                        </button>
                        <span className="text-sm font-bold text-primary w-8 text-center">{slideshowSettings.duration}s</span>
                        <button
                          onClick={() => setSlideshowSettings(prev => ({ ...prev, duration: Math.min(10, prev.duration + 1) }))}
                          className="w-8 h-8 rounded-full bg-white border border-gray-100 flex items-center justify-center text-secondary hover:bg-gray-50"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-secondary force-nowrap">切换动画</h4>
                        <p className="text-[10px] text-gray-400">选择幻灯片切换效果</p>
                      </div>
                      <div className="flex bg-white p-1 rounded-xl border border-gray-100">
                        <button
                          onClick={() => setSlideshowSettings(prev => ({ ...prev, transition: 'fade' }))}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all force-nowrap",
                            slideshowSettings.transition === 'fade' ? "bg-primary text-white" : "text-gray-400"
                          )}
                        >
                          淡入淡出
                        </button>
                        <button
                          onClick={() => setSlideshowSettings(prev => ({ ...prev, transition: 'slide' }))}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all force-nowrap",
                            slideshowSettings.transition === 'slide' ? "bg-primary text-white" : "text-gray-400"
                          )}
                        >
                          左右滑动
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-secondary force-nowrap">显示文物简介</h4>
                        <p className="text-[10px] text-gray-400">播放时是否展示详细文字描述</p>
                      </div>
                      <button
                        onClick={() => setSlideshowSettings(prev => ({ ...prev, showIntro: !prev.showIntro }))}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all relative",
                          slideshowSettings.showIntro ? "bg-primary" : "bg-gray-200"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                          slideshowSettings.showIntro ? "right-1" : "left-1"
                        )} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-secondary force-nowrap">循环播放</h4>
                        <p className="text-[10px] text-gray-400">播放结束后是否自动回到第一张</p>
                      </div>
                      <button
                        onClick={() => setSlideshowSettings(prev => ({ ...prev, loop: !prev.loop }))}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all relative",
                          slideshowSettings.loop ? "bg-primary" : "bg-gray-200"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                          slideshowSettings.loop ? "right-1" : "left-1"
                        )} />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'guide' && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">展览前言</label>
                  <textarea
                    value={opening}
                    onChange={e => setOpening(e.target.value)}
                    placeholder="写展览开场导语、观看线索或策展缘起..."
                    className="min-h-[180px] w-full resize-none rounded-3xl border border-gray-100 bg-gray-50 p-4 text-sm leading-relaxed text-gray-700 outline-none focus:border-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">展览结语</label>
                  <textarea
                    value={conclusion}
                    onChange={e => setConclusion(e.target.value)}
                    placeholder="写展览收束、观众带走的问题或总结..."
                    className="min-h-[180px] w-full resize-none rounded-3xl border border-gray-100 bg-gray-50 p-4 text-sm leading-relaxed text-gray-700 outline-none focus:border-primary"
                  />
                </div>
              </div>
            )}

            {activeTab === 'units' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">展览单元</h3>
                    <p className="mt-1 text-[10px] text-gray-400">可编辑单元文字，并调整文物所属单元和顺序。</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={onManageArtifacts}
                      className="px-3 py-2 bg-neutral text-primary rounded-xl text-[10px] font-bold flex items-center gap-1.5"
                    >
                      <Library size={14} /> 管理文物
                    </button>
                    <button
                      type="button"
                      onClick={addUnit}
                      className="rounded-xl bg-primary px-3 py-2 text-[10px] font-bold text-white"
                    >
                      新增单元
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {units.map((unit, index) => (
                    <div key={unit.id} className="rounded-3xl border border-gray-100 bg-gray-50 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-amber-700">第 {index + 1} 单元</span>
                        <button
                          type="button"
                          onClick={() => removeUnit(unit.id)}
                          className="text-[10px] font-bold text-rose-500"
                        >
                          删除
                        </button>
                      </div>
                      <div className="space-y-3">
                        <input
                          value={unit.title}
                          onChange={e => updateUnit(unit.id, { title: e.target.value })}
                          placeholder="单元名称"
                          className="w-full rounded-xl border border-gray-100 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-primary"
                        />
                        <textarea
                          value={unit.description}
                          onChange={e => updateUnit(unit.id, { description: e.target.value })}
                          placeholder="单元解说"
                          className="min-h-[88px] w-full resize-none rounded-xl border border-gray-100 bg-white px-3 py-2 text-xs text-gray-600 outline-none focus:border-primary"
                        />
                        <textarea
                          value={unit.curatorNote || ''}
                          onChange={e => updateUnit(unit.id, { curatorNote: e.target.value })}
                          placeholder="策展注释，可留空"
                          className="min-h-[64px] w-full resize-none rounded-xl border border-gray-100 bg-white px-3 py-2 text-xs text-gray-500 outline-none focus:border-primary"
                        />

                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-gray-400">本单元文物</p>
                          {unit.artifactIds.length === 0 && (
                            <div className="rounded-2xl bg-white p-4 text-center text-[11px] text-gray-300">这个单元还没有文物</div>
                          )}
                          {unit.artifactIds.map((artifactId, artifactIndex) => (
                            <div key={`${unit.id}-${artifactId}`} className="flex items-center gap-2 rounded-2xl bg-white p-2">
                              <span className="w-6 shrink-0 text-center text-[10px] font-bold text-amber-700">
                                {artifactIndex + 1}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-xs font-bold text-gray-700">
                                {artifactLabel(artifactMap.get(artifactId), artifactId)}
                              </span>
                              <select
                                value={unit.id}
                                onChange={e => moveArtifactToUnit(artifactId, e.target.value)}
                                className="max-w-[7rem] rounded-xl border border-gray-100 bg-gray-50 px-2 py-1.5 text-[10px] text-gray-600 outline-none"
                              >
                                {units.map(target => (
                                  <option key={target.id} value={target.id}>{target.title}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => moveArtifactWithinUnit(unit.id, artifactId, -1)}
                                className="rounded-lg bg-gray-50 p-1.5 text-gray-500 disabled:opacity-30"
                                disabled={artifactIndex === 0}
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveArtifactWithinUnit(unit.id, artifactId, 1)}
                                className="rounded-lg bg-gray-50 p-1.5 text-gray-500 disabled:opacity-30"
                                disabled={artifactIndex === unit.artifactIds.length - 1}
                              >
                                <ArrowDown size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'artifacts' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">展品说明</h3>
                    <p className="mt-1 text-[10px] text-gray-400">逐件编辑选择理由和展品角色。</p>
                  </div>
                  <button
                    onClick={onManageArtifacts}
                    className="px-3 py-2 bg-neutral text-primary rounded-xl text-[10px] font-bold flex items-center gap-1.5"
                  >
                    <Plus size={14} /> 管理文物
                  </button>
                </div>

                {exhibitionArtifactIds.length === 0 && (
                  <div className="rounded-3xl bg-gray-50 p-8 text-center">
                    <Library size={32} className="mx-auto text-gray-300" />
                    <p className="mt-2 text-xs text-gray-400">当前展览还没有文物</p>
                  </div>
                )}

                {exhibitionArtifactIds.map((artifactId, index) => (
                  <div key={artifactId} className="rounded-3xl border border-gray-100 bg-gray-50 p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-amber-700">展品 {String(index + 1).padStart(2, '0')}</p>
                        <h4 className="mt-1 truncate text-sm font-bold text-gray-900">
                          {artifactLabel(artifactMap.get(artifactId), artifactId)}
                        </h4>
                      </div>
                      <select
                        value={artifactRoles[artifactId] || '补充展品'}
                        onChange={e => setArtifactRoles(prev => ({ ...prev, [artifactId]: e.target.value as ExhibitionArtifactRole }))}
                        className="shrink-0 rounded-xl border border-gray-100 bg-white px-3 py-2 text-[10px] font-bold text-primary outline-none"
                      >
                        {ROLE_OPTIONS.map(role => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      value={selectionReasons[artifactId] || ''}
                      onChange={e => setSelectionReasons(prev => ({ ...prev, [artifactId]: e.target.value }))}
                      placeholder="为什么选择这件文物？它在这个展览里承担什么叙事作用？"
                      className="min-h-[112px] w-full resize-none rounded-2xl border border-gray-100 bg-white p-3 text-xs leading-relaxed text-gray-600 outline-none focus:border-primary"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="pt-8 border-t border-gray-100">
              <button
                onClick={() => {
                  if (window.confirm('确定要删除这个展陈吗？')) {
                    onDelete(exhibition.id);
                  }
                }}
                className="w-full py-4 text-rose-500 font-bold text-sm flex items-center justify-center gap-2 hover:bg-rose-50 rounded-2xl transition-all"
              >
                <Trash2 size={18} />
                删除展陈
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
