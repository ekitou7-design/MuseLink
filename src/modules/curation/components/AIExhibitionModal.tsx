import { useRef, useState } from 'react';
import { Bookmark, Loader2, Mic, MicOff, Music, Sparkles, X, Zap } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Artifact, Exhibition } from '../../../types';
import { SafeImage } from '../../../components/SafeImage';
import { artifactNameRaw, displayDbString } from '../../../lib/dbDisplay';
import { cn } from '../../../lib/utils';

export const AIExhibitionModal = ({ 
  isOpen, 
  onClose, 
  onGenerate, 
  isGenerating, 
  result,
  onCollect,
  artifacts
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onGenerate: (keywords: string, generateBGM: boolean) => void,
  isGenerating: boolean,
  result: Partial<Exhibition> | null,
  onCollect: () => void,
  artifacts: Artifact[]
}) => {
  const [keywords, setKeywords] = useState('');
  const [generateBGM, setGenerateBGM] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const speechSupported = typeof window !== "undefined" && Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const toggleVoiceInput = () => {
    if (!speechSupported) {
      setKeywords(prev => prev || "请描述一次旅行中的文化体验、一件印象深刻的文物，或你喜欢的建筑风格。");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop?.();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0]?.transcript || "")
        .join("");
      if (transcript.trim()) setKeywords(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          className="fixed inset-0 z-[200] bg-white flex flex-col"
        >
          <div className="p-4 flex items-center justify-between border-b border-gray-100">
            <button onClick={onClose} className="p-2 text-gray-400"><X size={24} /></button>
            <h2 className="text-lg font-serif font-bold">AI 智能策展</h2>
            <div className="w-10" />
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
            <div className="space-y-4">
              <div className="bg-neutral rounded-3xl p-6 border border-gray-100 space-y-4">
                <div className="flex items-center gap-2 text-primary">
                  <Sparkles size={18} />
                  <span className="text-sm font-bold">一句话生成展览</span>
                </div>
                <div className="relative">
                  <textarea 
                    value={keywords}
                    onChange={e => setKeywords(e.target.value)}
                    placeholder="例如：帮我策划一个关于江南文人生活的展览；或直接说一次旅行中的文化体验、印象深刻的文物、喜欢的建筑风格"
                    className="w-full bg-white border-none rounded-2xl p-4 pr-14 text-sm min-h-[124px] focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={toggleVoiceInput}
                    className={cn(
                      "absolute right-3 bottom-3 w-10 h-10 rounded-full flex items-center justify-center transition-all",
                      isListening ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20" : "bg-primary text-white shadow-lg shadow-primary/20"
                    )}
                    title={speechSupported ? "语音策展" : "当前浏览器不支持语音识别"}
                  >
                    {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {["江南文人生活", "宋代器物美学", "旅行中的古建印象"].map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setKeywords(`帮我策划一个关于${example}的展览`)}
                      className="min-h-9 rounded-[5px] bg-white px-2 text-[10px] font-bold text-gray-600 border border-gray-100"
                    >
                      {example}
                    </button>
                  ))}
                </div>
                
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <Music size={16} className="text-primary" />
                    <span className="text-xs font-bold text-secondary force-nowrap">生成专属背景音乐</span>
                  </div>
                  <button 
                    onClick={() => setGenerateBGM(!generateBGM)}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      generateBGM ? "bg-primary" : "bg-gray-200"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                      generateBGM ? "right-1" : "left-1"
                    )} />
                  </button>
                </div>

                <button 
                  onClick={() => onGenerate(keywords, generateBGM)}
                  disabled={isGenerating || !keywords.trim()}
                  className="w-full py-3.5 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                  {isGenerating ? '正在从后端文物库策展...' : '开口 / 输入即可策展'}
                </button>
              </div>
            </div>

            {result && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">AI 策展结果</h3>
                  <div className="bg-white rounded-[5px] border border-gray-100 overflow-hidden shadow-sm">
                    <div className="aspect-video relative">
                      <SafeImage 
                        src={result.coverUrl} 
                        className="w-full h-full object-cover" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                      <div className="absolute bottom-4 left-6 right-6 text-white">
                        <h4 className="text-xl font-serif font-bold">{result.title}</h4>
                        <p className="break-words text-[10px] opacity-80 mt-1">{result.intro}</p>
                      </div>
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="flex gap-3 overflow-x-auto no-scrollbar">
                        {result.artifactIds?.map(id => {
                          const artifact = artifacts.find(a => a.id === id);
                          if (!artifact) return null;
                          return (
                            <div key={`ai-result-art-${id}`} className="w-24 flex-shrink-0 space-y-2">
                              <SafeImage 
                                src={artifact.imageUrl} 
                                className="aspect-square rounded-xl overflow-hidden bg-gray-50"
                              />
                              <p className="break-words text-[10px] font-bold text-gray-800">{displayDbString(artifactNameRaw(artifact))}</p>
                            </div>
                          );
                        })}
                      </div>
                      <button 
                        onClick={onCollect}
                        className="w-full py-3 bg-neutral text-primary rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                      >
                        <Bookmark size={14} />
                        收藏并加入我的展陈
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
