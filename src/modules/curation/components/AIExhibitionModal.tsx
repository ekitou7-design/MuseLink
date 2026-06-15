import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Bookmark, Loader2, Mic, MicOff, Music, RefreshCw, Share2, Sparkles, X, Zap } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Artifact, Exhibition } from '../../../types';
import { SafeImage } from '../../../components/SafeImage';
import { artifactImageUrlRaw, artifactNameRaw, displayDbString } from '../../../lib/dbDisplay';
import { cn } from '../../../lib/utils';
import {
  CONTENT_CURATION_QUESTIONS,
  type CuratorGuideAnswers,
} from '../data/curatorPreferences';
import { ExhibitionShareModal } from '../../exhibitions/components/ExhibitionShareModal';

function buildQuestionPlaceholder(question: (typeof CONTENT_CURATION_QUESTIONS)[number]) {
  const hints = question.options.map((option, index) => {
    const prefix = String.fromCharCode(65 + index);
    return `${prefix}. ${option.label}`;
  }).join(' / ');
  return `可以参考：${hints}\n也可以写自己的想法`;
}

function cleanGuideAnswers(guideAnswers: CuratorGuideAnswers): CuratorGuideAnswers {
  return Object.fromEntries(
    Object.entries(guideAnswers)
      .map(([id, value]) => [id, value.trim()])
      .filter(([, value]) => value),
  );
}

function curationSourceLabel(result: Partial<Exhibition> | null): string {
  if (!result) return '';
  if (result.source === 'local-fallback' || result.aiGenerated === false) return '本地规则草稿';
  if (result.source === 'ai' || result.aiGenerated === true) return 'AI 生成';
  return '';
}

export const AIExhibitionModal = ({ 
  isOpen, 
  onClose, 
  onGenerate, 
  isGenerating, 
  result,
  onCollect,
  onManualCreate,
  artifacts,
  initialKeywords = '',
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onGenerate: (keywords: string, generateBGM: boolean, guideAnswers: CuratorGuideAnswers) => void,
  isGenerating: boolean,
  result: Partial<Exhibition> | null,
  onCollect: () => void,
  onManualCreate?: () => void,
  artifacts: Artifact[],
  initialKeywords?: string,
}) => {
  const [keywords, setKeywords] = useState('');
  const [generateBGM, setGenerateBGM] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [localFallbackAcknowledged, setLocalFallbackAcknowledged] = useState(false);
  const [guideAnswers, setGuideAnswers] = useState<CuratorGuideAnswers>({});
  const recognitionRef = useRef<any>(null);
  const answeredCount = Object.values(guideAnswers).filter((value) => value.trim()).length;
  const canGenerate = keywords.trim().length > 0 || answeredCount > 0;
  const isLocalFallback = Boolean(result && (result.source === 'local-fallback' || result.aiGenerated === false));
  const sourceLabel = curationSourceLabel(result);

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

  useEffect(() => {
    if (!isOpen) {
      setGuideAnswers({});
      setKeywords('');
      setIsListening(false);
      setIsShareOpen(false);
      setLocalFallbackAcknowledged(false);
    }
  }, [isOpen]);

  useEffect(() => {
    setLocalFallbackAcknowledged(false);
  }, [result?.source, result?.aiGenerated]);

  useEffect(() => {
    if (isOpen && initialKeywords.trim()) {
      setKeywords(initialKeywords);
    }
  }, [initialKeywords, isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          className="fixed inset-0 z-[200] flex flex-col overflow-hidden bg-[var(--app-page-bg)]"
        >
          <div className="ios-title-bar flex shrink-0 items-center justify-between border-b border-gray-100 bg-[var(--app-bar-bg)] px-4 backdrop-blur-xl">
            <button onClick={onClose} className="p-2 text-gray-400"><X size={24} /></button>
            <h2 className="text-lg font-serif font-bold">AI 智能策展</h2>
            <div className="w-10" />
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
            <div className="shrink-0 space-y-3">
              <div className="ios-card space-y-3 border border-gray-100 bg-white p-4">
                <div className="flex items-center gap-2 text-primary">
                  <Sparkles size={18} />
                  <span className="text-sm font-bold">一句话生成展览</span>
                </div>
                <div className="relative">
                  <textarea 
                    value={keywords}
                    onChange={e => setKeywords(e.target.value)}
                    placeholder="例如：帮我策划一个关于江南文人生活的展览；或直接说一次旅行中的文化体验、印象深刻的文物、喜欢的建筑风格"
                    className="ios-input min-h-[88px] w-full resize-none border-none bg-[#F7F7F8] p-3 pr-14 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
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
                
                <div className="flex items-center justify-between">
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
              </div>

              <div className="rounded-[5px] border border-amber-100 bg-amber-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">生成前引导</p>
                    <h3 className="mt-1 text-sm font-bold text-gray-900">左右滑动回答引导问题</h3>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-amber-800">
                    内容线索 {answeredCount}
                  </span>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
              {!result ? (
                <div className="h-full overflow-x-auto overflow-y-hidden no-scrollbar">
                  <div className="flex h-full snap-x snap-mandatory gap-3">
                {CONTENT_CURATION_QUESTIONS.map((question) => (
                  <section key={question.id} className="ios-card flex h-full w-[86%] shrink-0 snap-center flex-col space-y-3 border border-gray-100 bg-white p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <span className="rounded-[5px] bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-500">{question.title}</span>
                      <h3 className="break-words text-sm font-bold leading-snug text-gray-900">{question.prompt}</h3>
                    </div>
                    <textarea
                      value={guideAnswers[question.id] || ''}
                      onChange={(event) => setGuideAnswers((prev) => ({ ...prev, [question.id]: event.target.value }))}
                      placeholder={buildQuestionPlaceholder(question)}
                      className="min-h-0 flex-1 w-full resize-none rounded-[5px] border border-gray-100 bg-gray-50 p-3 text-xs leading-relaxed text-gray-700 outline-none transition-all placeholder:text-gray-400 focus:border-amber-200 focus:bg-white focus:ring-2 focus:ring-amber-100"
                    />
                  </section>
                ))}
                  </div>
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  className="ios-card flex h-full flex-col overflow-hidden border border-gray-100 bg-white shadow-sm"
                >
                  <div className="relative h-32 shrink-0">
                    <SafeImage 
                      src={result.coverUrl} 
                      className="h-full w-full object-cover" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4 text-white">
                      <h4 className="line-clamp-1 text-lg font-serif font-bold">{result.title}</h4>
                      <p className="mt-1 line-clamp-2 text-[10px] opacity-85">{result.intro}</p>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 space-y-3 overflow-hidden p-4">
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">AI 策展结果</h3>
                        {sourceLabel && (
                          <span className={cn(
                            "shrink-0 rounded-full px-2 py-1 text-[10px] font-bold",
                            isLocalFallback ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                          )}>
                            {sourceLabel}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-gray-500">
                        这是为你生成的个人展览预览。确认后可以一键保存到“我的策展”。
                      </p>
                    </div>
                    {isLocalFallback && !localFallbackAcknowledged && (
                      <div className="rounded-[5px] border border-rose-100 bg-rose-50 p-3">
                        <div className="flex items-start gap-2">
                          <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-500" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-rose-700">AI 生成失败，当前展示的是本地规则草稿。</p>
                            {result.generationError && (
                              <p className="mt-1 max-h-24 overflow-y-auto break-words text-[10px] leading-relaxed text-rose-500">{result.generationError}</p>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => onGenerate(keywords.trim(), generateBGM, cleanGuideAnswers(guideAnswers))}
                            disabled={isGenerating || !canGenerate}
                            className="flex items-center justify-center gap-1.5 rounded-[5px] bg-rose-600 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-50"
                          >
                            <RefreshCw size={13} />
                            重新调用 AI
                          </button>
                          <button
                            type="button"
                            onClick={() => setLocalFallbackAcknowledged(true)}
                            className="rounded-[5px] bg-white px-3 py-2 text-[10px] font-bold text-rose-700 shadow-sm"
                          >
                            使用本地规则草稿
                          </button>
                        </div>
                      </div>
                    )}
                    {result.aiCuration && (
                      <div className="max-h-[42%] space-y-2 overflow-hidden rounded-[5px] bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
                        {result.aiCuration.opening && (
                          <p className="line-clamp-3">{result.aiCuration.opening}</p>
                        )}
                        {result.aiCuration.sections && result.aiCuration.sections.length > 0 && (
                          <div className="space-y-1.5">
                            {result.aiCuration.sections.slice(0, 2).map((section, index) => (
                              <div key={`${section.title}-${index}`}>
                                <p className="line-clamp-1 font-bold">{section.title}</p>
                                <p className="mt-0.5 line-clamp-2 text-amber-900/75">{section.summary}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex gap-3 overflow-x-auto overflow-y-hidden no-scrollbar">
                      {result.artifactIds?.map(id => {
                        const artifact = artifacts.find(a => a.id === id);
                        if (!artifact) return null;
                        return (
                          <div key={`ai-result-art-${id}`} className="w-24 flex-shrink-0 space-y-2">
                            <SafeImage 
                              src={String(artifactImageUrlRaw(artifact, "thumbnail") ?? "")} 
                              width={96}
                              height={96}
                              className="aspect-square rounded-xl bg-gray-50 object-cover"
                            />
                            <p className="line-clamp-2 text-[10px] font-bold text-gray-800">{displayDbString(artifactNameRaw(artifact))}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            <div className="shrink-0 space-y-2 border-t border-gray-100 bg-[var(--app-page-bg)] pt-3">
              <button 
                onClick={() => onGenerate(keywords.trim(), generateBGM, cleanGuideAnswers(guideAnswers))}
                disabled={isGenerating || !canGenerate}
                className="flex w-full items-center justify-center gap-2 rounded-[5px] bg-primary py-3.5 font-bold text-white shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                {isGenerating ? '正在从后端文物库策展...' : '生成个人展览'}
              </button>
              {result && (
                <button
                  type="button"
                  onClick={() => setIsShareOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-[5px] bg-white py-3 text-xs font-bold text-gray-600 shadow-sm"
                >
                  <Share2 size={14} />
                  分享展览
                </button>
              )}
              {result && (
                <button 
                  onClick={onCollect}
                  className="flex w-full items-center justify-center gap-2 rounded-[5px] bg-white py-3 text-xs font-bold text-primary shadow-sm"
                >
                  <Bookmark size={14} />
                  保存为我的个人展览
                </button>
              )}
              {onManualCreate && (
                <button
                  type="button"
                  onClick={onManualCreate}
                  className="w-full py-1.5 text-xs font-bold text-gray-400 transition-colors hover:text-primary"
                >
                  手动新建
                </button>
              )}
            </div>
          </div>
          {result && (
            <ExhibitionShareModal
              isOpen={isShareOpen}
              exhibition={result}
              onClose={() => setIsShareOpen(false)}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
