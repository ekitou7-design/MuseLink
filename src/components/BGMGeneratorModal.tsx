import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Music, 
  Play, 
  Pause, 
  RotateCcw, 
  Check, 
  Library, 
  Sparkles, 
  Volume2,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { Exhibition, BGM } from '../types';
import { cn } from '../lib/utils';
import { AmbientAudioPlayer, isAmbientBgmUrl } from '../lib/ambientAudio';

const BGM_STYLES = [
  { id: 'gallery', label: '展厅氛围', icon: '🏛️', description: '低音量空间环境音，不打扰观展' },
  { id: 'silent', label: '静默', icon: '🌙', description: '不播放音乐，只保留沉浸视觉' },
];

const MOCK_BGMS: BGM[] = [
  { id: 'bgm1', userId: 'system', title: '展厅氛围', url: 'ambient://gallery', style: 'gallery', createdAt: new Date().toISOString() },
  { id: 'bgm2', userId: 'system', title: '静默', url: 'ambient://silent', style: 'silent', createdAt: new Date().toISOString() },
];

interface BGMGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  exhibition: Exhibition;
  onBind: (bgmUrl: string) => void;
}

export const BGMGeneratorModal: React.FC<BGMGeneratorModalProps> = ({
  isOpen,
  onClose,
  exhibition,
  onBind
}) => {
  const [step, setStep] = useState<'style' | 'generating' | 'result' | 'library'>('style');
  const [selectedStyle, setSelectedStyle] = useState(BGM_STYLES[0]);
  const [generatedBGM, setGeneratedBGM] = useState<BGM | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio] = useState(new Audio());
  const ambientRef = useRef<AmbientAudioPlayer | null>(null);
  const [userLibrary, setUserLibrary] = useState<BGM[]>(MOCK_BGMS);

  const stopPreview = () => {
    audio.pause();
    ambientRef.current?.stop();
  };

  const playPreview = async (url: string) => {
    stopPreview();
    if (isAmbientBgmUrl(url)) {
      if (!ambientRef.current) ambientRef.current = new AmbientAudioPlayer();
      await ambientRef.current.start(url);
      return;
    }
    audio.volume = 0.2;
    audio.src = url;
    await audio.play();
  };

  useEffect(() => {
    if (!isOpen) {
      stopPreview();
      setIsPlaying(false);
      setStep('style');
    }
    return () => {
      stopPreview();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, audio]);

  useEffect(() => {
    return () => {
      ambientRef.current?.dispose();
    };
  }, []);

  const handleGenerate = () => {
    setStep('generating');
    setTimeout(() => {
      const newBGM: BGM = {
        id: `bgm-${Date.now()}`,
        userId: exhibition.userId,
        title: `${selectedStyle.label} - ${exhibition.title}`,
        url: MOCK_BGMS[Math.floor(Math.random() * MOCK_BGMS.length)].url,
        style: selectedStyle.id,
        createdAt: new Date().toISOString()
      };
      setGeneratedBGM(newBGM);
      setStep('result');
      setIsPlaying(false);
    }, 3000);
  };

  const togglePlay = () => {
    if (!generatedBGM) return;
    if (isPlaying) {
      stopPreview();
    } else {
      playPreview(generatedBGM.url).catch(console.error);
    }
    setIsPlaying(!isPlaying);
  };

  const handleSaveToLibrary = () => {
    if (generatedBGM) {
      setUserLibrary(prev => [generatedBGM, ...prev]);
      // Show success toast or something
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-6">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          className="relative w-full max-w-lg bg-white rounded-t-[40px] sm:rounded-[40px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                <Music size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold font-serif text-secondary force-nowrap">AI 展陈 BGM 生成</h3>
                <p className="text-[10px] text-gray-400 force-nowrap">为您的展陈定制专属背景音乐</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
            {step === 'style' && (
              <div className="space-y-6">
                <div className="bg-neutral p-4 rounded-2xl border border-gray-100 space-y-2">
                  <h4 className="text-xs font-bold text-secondary flex items-center gap-2 force-nowrap">
                    <Sparkles size={14} className="text-primary" />
                    AI 智能解析
                  </h4>
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    已读取展陈主题：<span className="text-secondary font-bold">「{exhibition.title}」</span><br />
                    推荐风格：<span className="text-primary font-bold">庄重史诗</span>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {BGM_STYLES.map(style => (
                    <button
                      key={style.id}
                      onClick={() => setSelectedStyle(style)}
                      className={cn(
                        "p-4 rounded-3xl border-2 transition-all text-left space-y-2",
                        selectedStyle.id === style.id 
                          ? "border-primary bg-primary/5" 
                          : "border-gray-50 bg-white hover:border-gray-100"
                      )}
                    >
                      <span className="text-2xl">{style.icon}</span>
                      <div>
                        <h5 className="text-xs font-bold text-secondary force-nowrap">{style.label}</h5>
                        <p className="text-[10px] text-gray-400 line-clamp-1">{style.description}</p>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="pt-4">
                  <button 
                    onClick={handleGenerate}
                    className="w-full py-4 bg-primary text-white rounded-2xl font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all active:scale-95 force-nowrap"
                  >
                    开始生成专属 BGM
                  </button>
                  <button 
                    onClick={() => setStep('library')}
                    className="w-full py-4 text-gray-400 text-xs font-bold flex items-center justify-center gap-2 force-nowrap"
                  >
                    <Library size={14} />
                    从我的 BGM 库中选择
                  </button>
                </div>
              </div>
            )}

            {step === 'generating' && (
              <div className="py-20 flex flex-col items-center justify-center space-y-8">
                <div className="relative">
                  <div className="w-32 h-32 border-4 border-primary/10 rounded-full animate-spin border-t-primary" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Music size={40} className="text-primary animate-bounce" />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <h4 className="text-lg font-bold text-secondary font-serif">正在谱写乐章...</h4>
                  <p className="text-xs text-gray-400">AI 正在根据展陈内容生成匹配的旋律</p>
                </div>
                <div className="w-full max-w-xs bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 3 }}
                  />
                </div>
              </div>
            )}

            {step === 'result' && generatedBGM && (
              <div className="space-y-8">
                <div className="bg-neutral rounded-[32px] p-8 flex flex-col items-center space-y-6 border border-gray-100">
                  <div className="relative">
                    <div className={cn(
                      "w-48 h-48 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-2xl transition-all duration-1000",
                      isPlaying ? "scale-105 rotate-12" : "scale-100 rotate-0"
                    )}>
                      <Music size={80} className="text-white/20" />
                    </div>
                    <button 
                      onClick={togglePlay}
                      className="absolute inset-0 flex items-center justify-center group"
                    >
                      <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/30 group-hover:scale-110 transition-all">
                        {isPlaying ? <Pause size={40} fill="currentColor" /> : <Play size={40} fill="currentColor" className="ml-2" />}
                      </div>
                    </button>
                  </div>

                  <div className="text-center space-y-2">
                    <h4 className="text-xl font-bold text-secondary font-serif">{generatedBGM.title}</h4>
                    <div className="flex items-center justify-center gap-2">
                      <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-full">{selectedStyle.label}</span>
                      <span className="text-[10px] text-gray-400">时长 02:45</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setStep('style')}
                    className="py-4 bg-neutral text-secondary rounded-2xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-gray-100 transition-all force-nowrap"
                  >
                    <RotateCcw size={16} />
                    重新生成
                  </button>
                  <button 
                    onClick={handleSaveToLibrary}
                    className="py-4 bg-neutral text-secondary rounded-2xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-gray-100 transition-all force-nowrap"
                  >
                    <Library size={16} />
                    保存到库
                  </button>
                  <button 
                    onClick={() => onBind(generatedBGM.url)}
                    className="col-span-2 py-4 bg-primary text-white rounded-2xl font-bold shadow-xl shadow-primary/20 flex items-center justify-center gap-2 hover:scale-[1.02] transition-all active:scale-95 force-nowrap"
                  >
                    <Check size={20} />
                    绑定到当前展陈
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 text-center italic">
                  * 本音乐为 AI 生成，仅供本展陈非商用展示使用
                </p>
              </div>
            )}

            {step === 'library' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">我的 BGM 库</h4>
                  <button onClick={() => setStep('style')} className="text-[10px] font-bold text-primary force-nowrap">去生成新音乐</button>
                </div>
                
                <div className="space-y-3">
                  {userLibrary.map(bgm => (
                    <div 
                      key={bgm.id}
                      className="p-4 bg-neutral rounded-2xl border border-gray-100 flex items-center gap-4 group hover:border-primary/30 transition-all cursor-pointer"
                      onClick={() => onBind(bgm.url)}
                    >
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm group-hover:bg-primary group-hover:text-white transition-all">
                        <Music size={20} />
                      </div>
                      <div className="flex-1">
                        <h5 className="text-xs font-bold text-secondary force-nowrap">{bgm.title}</h5>
                        <p className="text-[10px] text-gray-400">{bgm.style} · {new Date(bgm.createdAt).toLocaleDateString()}</p>
                      </div>
                      <ChevronRight size={16} className="text-gray-300" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
