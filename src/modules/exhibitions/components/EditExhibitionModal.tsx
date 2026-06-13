import { useEffect, useState } from 'react';
import { Library, Music, Palette, Play, Plus, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Artifact, Exhibition, ExhibitionUnit, SlideshowSettings } from '../../../types';
import { cn } from '../../../lib/utils';
import { normalizeExhibitionUnits } from '../lib/exhibitionUnits';

export const EditExhibitionModal = ({ 
  isOpen, 
  onClose, 
  exhibition, 
  onUpdate, 
  onDelete, 
  onManageArtifacts,
  onSlideshowPreview,
  onBGMGenerate
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  exhibition: Exhibition | null, 
  onUpdate: (updated: Partial<Exhibition>) => void,
  onDelete: (id: string) => void,
  onManageArtifacts: () => void,
  onSlideshowPreview: () => void,
  onBGMGenerate: () => void
}) => {
  const [title, setTitle] = useState('');
  const [intro, setIntro] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [bgmUrl, setBgmUrl] = useState('');
  const [units, setUnits] = useState<ExhibitionUnit[]>([]);
  const [slideshowSettings, setSlideshowSettings] = useState<SlideshowSettings>({
    duration: 4,
    transition: 'fade',
    showIntro: true,
    loop: true
  });

  useEffect(() => {
    if (exhibition) {
      setTitle(exhibition.title);
      setIntro(exhibition.intro);
      setCoverUrl(exhibition.coverUrl);
      setBgmUrl(exhibition.bgmUrl || '');
      setUnits(normalizeExhibitionUnits(exhibition));
      if (exhibition.slideshowSettings) {
        setSlideshowSettings(exhibition.slideshowSettings);
      }
    }
  }, [exhibition]);

  if (!exhibition) return null;

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
              onClick={() => onUpdate({ title, intro, coverUrl, bgmUrl, slideshowSettings, units })}
              className="px-4 py-1.5 bg-primary text-white rounded-full text-xs font-bold"
            >
              保存
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
            {/* Top Toolbar */}
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

            {/* Playlist-like Header Edit */}
            <div className="flex gap-6">
              <div className="w-32 h-32 rounded-2xl overflow-hidden bg-gray-100 relative group flex-shrink-0 shadow-lg">
                <img src={coverUrl} className="w-full h-full object-cover" />
                <button 
                  onClick={() => {
                    const newUrl = window.prompt('输入封面图片 URL', coverUrl);
                    if (newUrl) setCoverUrl(newUrl);
                  }}
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-1"
                >
                  <Palette size={20} />
                  <span className="text-[10px] font-bold">更换封面</span>
                </button>
              </div>
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
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">展陈简介</label>
                  <textarea 
                    value={intro}
                    onChange={e => setIntro(e.target.value)}
                    placeholder="添加展陈描述..."
                    className="w-full bg-transparent border-none text-sm min-h-[60px] outline-none resize-none text-gray-500"
                  />
                </div>
              </div>
            </div>

            {/* Slideshow Settings */}
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

            <div className="space-y-4 pt-4 border-t border-gray-50">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">展陈内容</h3>
                <button 
                  onClick={onManageArtifacts}
                  className="px-4 py-2 bg-neutral text-primary rounded-xl text-[10px] font-bold flex items-center gap-1.5 hover:bg-gray-100 transition-all"
                >
                  <Plus size={14} /> 管理文物
                </button>
              </div>
              
              <div className="bg-gray-50 rounded-3xl p-6 text-center space-y-2">
                <Library size={32} className="mx-auto text-gray-300" />
                <p className="text-xs text-gray-400">当前展陈包含 {exhibition.artifactIds?.length ?? 0} 件文物</p>
                <p className="text-[10px] text-gray-300">点击上方按钮管理文物列表</p>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-gray-50">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">展览单元</h3>
                <button
                  type="button"
                  onClick={() => setUnits(prev => [
                    ...prev,
                    {
                      id: `unit-${Date.now()}`,
                      title: `第 ${prev.length + 1} 单元`,
                      description: '填写这一单元希望观众看到的线索。',
                      artifactIds: [],
                      curatorNote: '',
                    },
                  ])}
                  className="rounded-xl bg-neutral px-3 py-2 text-[10px] font-bold text-primary"
                >
                  新增单元
                </button>
              </div>

              <div className="space-y-3">
                {units.map((unit, index) => (
                  <div key={unit.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-amber-700">第 {index + 1} 单元</span>
                      <button
                        type="button"
                        onClick={() => setUnits(prev => prev.filter(item => item.id !== unit.id))}
                        className="text-[10px] font-bold text-rose-500"
                      >
                        删除
                      </button>
                    </div>
                    <div className="space-y-3">
                      <input
                        value={unit.title}
                        onChange={e => setUnits(prev => prev.map(item => item.id === unit.id ? { ...item, title: e.target.value } : item))}
                        placeholder="单元标题"
                        className="w-full rounded-xl border border-gray-100 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-primary"
                      />
                      <textarea
                        value={unit.description}
                        onChange={e => setUnits(prev => prev.map(item => item.id === unit.id ? { ...item, description: e.target.value } : item))}
                        placeholder="单元说明"
                        className="min-h-[64px] w-full resize-none rounded-xl border border-gray-100 bg-white px-3 py-2 text-xs text-gray-600 outline-none focus:border-primary"
                      />
                      <textarea
                        value={unit.curatorNote || ''}
                        onChange={e => setUnits(prev => prev.map(item => item.id === unit.id ? { ...item, curatorNote: e.target.value } : item))}
                        placeholder="策展备注，可留空"
                        className="min-h-[54px] w-full resize-none rounded-xl border border-gray-100 bg-white px-3 py-2 text-xs text-gray-500 outline-none focus:border-primary"
                      />
                      <input
                        value={unit.artifactIds.join(', ')}
                        onChange={e => setUnits(prev => prev.map(item => item.id === unit.id ? {
                          ...item,
                          artifactIds: e.target.value.split(/[,，、\s]+/).map(id => id.trim()).filter(Boolean),
                        } : item))}
                        placeholder="展品 ID，用逗号分隔，例如 189, 190"
                        className="w-full rounded-xl border border-gray-100 bg-white px-3 py-2 font-mono text-[11px] text-gray-500 outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

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
