import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  Headphones,
  Map,
  Mouse,
  Pause,
  Play,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { Artifact, Exhibition, SlideshowSettings } from '../types';
import { cn } from '../lib/utils';
import { AmbientAudioPlayer, DEFAULT_AMBIENT_BGM, isAmbientBgmUrl } from '../lib/ambientAudio';
import {
  artifactDescriptionRaw,
  artifactEraRaw,
  artifactImageUrlRaw,
  artifactMuseumRaw,
  artifactNameRaw,
  displayDbString,
} from '../lib/dbDisplay';
import { SafeImage } from './SafeImage';

interface SlideshowOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  exhibition: Exhibition;
  artifacts: Artifact[];
  settings?: SlideshowSettings;
  bgmUrl?: string;
}

const sceneThemes = [
  {
    wall: 'from-[#2f352f] via-[#47513f] to-[#1d211c]',
    panel: 'bg-[#efe6d1]',
    accent: '#f1d27a',
    text: 'text-[#fff4d3]',
  },
  {
    wall: 'from-[#242c33] via-[#43576a] to-[#171d23]',
    panel: 'bg-[#e8edf0]',
    accent: '#9dc7d8',
    text: 'text-[#e8f6ff]',
  },
  {
    wall: 'from-[#3c2622] via-[#6b4437] to-[#201412]',
    panel: 'bg-[#f1dfcc]',
    accent: '#efbd7a',
    text: 'text-[#ffe4c3]',
  },
  {
    wall: 'from-[#262336] via-[#514b68] to-[#171521]',
    panel: 'bg-[#eee8f5]',
    accent: '#c7b7ef',
    text: 'text-[#f0eaff]',
  },
];

export const SlideshowOverlay: React.FC<SlideshowOverlayProps> = ({
  isOpen,
  onClose,
  exhibition,
  artifacts,
  settings: initialSettings,
  bgmUrl,
}) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ambientRef = useRef<AmbientAudioPlayer | null>(null);
  const autoplayRef = useRef<NodeJS.Timeout | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(Boolean(bgmUrl));
  const [isMuted, setIsMuted] = useState(false);
  const [autoRoam, setAutoRoam] = useState(false);

  const settings = initialSettings || {
    duration: 5,
    transition: 'slide',
    showIntro: true,
    loop: true,
  };

  const safeArtifacts = useMemo(() => artifacts.filter(Boolean), [artifacts]);
  const sceneCount = safeArtifacts.length + 1;
  const progress = sceneCount > 1 ? (currentIndex / (sceneCount - 1)) * 100 : 0;
  const coverImage =
    exhibition.coverUrl ||
    String(artifactImageUrlRaw(safeArtifacts[0]) ?? '');
  const activeBgmUrl = bgmUrl || DEFAULT_AMBIENT_BGM;
  const hasAmbientBgm = isAmbientBgmUrl(activeBgmUrl);

  const scrollToScene = useCallback((index: number) => {
    const targetIndex = Math.max(0, Math.min(index, sceneCount - 1));
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({
      left: targetIndex * viewport.clientWidth,
      behavior: settings.transition === 'fade' ? 'auto' : 'smooth',
    });
    setCurrentIndex(targetIndex);
  }, [sceneCount, settings.transition]);

  const goNext = useCallback(() => {
    if (currentIndex >= sceneCount - 1) {
      if (settings.loop) scrollToScene(0);
      else setAutoRoam(false);
      return;
    }
    scrollToScene(currentIndex + 1);
  }, [currentIndex, sceneCount, scrollToScene, settings.loop]);

  const goPrev = useCallback(() => {
    scrollToScene(currentIndex - 1);
  }, [currentIndex, scrollToScene]);

  useEffect(() => {
    if (!isOpen) return;
    setCurrentIndex(0);
    setAutoRoam(false);
    requestAnimationFrame(() => viewportRef.current?.scrollTo({ left: 0 }));
    if ('wakeLock' in navigator) {
      (navigator as any).wakeLock.request('screen').catch(console.error);
    }
  }, [isOpen, exhibition.id]);

  useEffect(() => {
    if (!isOpen || !activeBgmUrl) return;

    if (hasAmbientBgm) {
      if (!ambientRef.current) ambientRef.current = new AmbientAudioPlayer();
      ambientRef.current.setMuted(isMuted);
      if (isAudioPlaying) {
        ambientRef.current.start(activeBgmUrl).catch(() => setIsAudioPlaying(false));
      } else {
        ambientRef.current.stop();
      }
      return;
    }

    if (audioRef.current) {
      audioRef.current.muted = isMuted;
      if (isAudioPlaying) {
        audioRef.current.play().catch(() => setIsAudioPlaying(false));
      } else {
        audioRef.current.pause();
      }
    }
  }, [activeBgmUrl, hasAmbientBgm, isAudioPlaying, isMuted, isOpen]);

  useEffect(() => {
    return () => {
      ambientRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setIsAudioPlaying(true);
    } else {
      ambientRef.current?.stop();
      audioRef.current?.pause();
    }
  }, [isOpen, exhibition.id]);

  useEffect(() => {
    if (!autoRoam || !isOpen) return;
    autoplayRef.current = setInterval(goNext, Math.max(2, settings.duration) * 1000);
    return () => {
      if (autoplayRef.current) clearInterval(autoplayRef.current);
    };
  }, [autoRoam, goNext, isOpen, settings.duration]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') goNext();
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') goPrev();
      if (event.key === ' ') {
        event.preventDefault();
        setAutoRoam((value) => !value);
      }
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev, isOpen, onClose]);

  const handleScroll = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const index = Math.round(viewport.scrollLeft / Math.max(1, viewport.clientWidth));
    setCurrentIndex(Math.max(0, Math.min(index, sceneCount - 1)));
  };

  const toggleAudio = () => {
    if (isMuted) {
      setIsMuted(false);
      setIsAudioPlaying(true);
      return;
    }
    setIsAudioPlaying((value) => !value);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[400] overflow-hidden bg-[#11100d] text-white"
      >
        {!hasAmbientBgm && activeBgmUrl && <audio ref={audioRef} src={activeBgmUrl} loop muted={isMuted} />}

        <div
          ref={viewportRef}
          onScroll={handleScroll}
          className="h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth no-scrollbar"
        >
          <div className="flex h-full w-max">
            <section className="relative h-full w-screen snap-start overflow-hidden bg-[#191611]">
              <SafeImage src={coverImage} className="absolute inset-0 h-full w-full object-cover opacity-70" />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.82),rgba(0,0,0,0.34)_45%,rgba(0,0,0,0.72))]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_68%_38%,rgba(255,219,142,0.18),transparent_34%)]" />

              <div className="relative z-10 flex h-full items-center px-7 py-24 md:px-16">
                <div className="max-w-xl">
                  <div className="mb-5 inline-flex items-center gap-2 border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.26em] text-white/76 backdrop-blur-md">
                    <Headphones size={16} />
                    Immersive Exhibition
                  </div>
                  <h1 className="break-words font-serif text-4xl font-bold leading-tight text-[#fff4d3] md:text-7xl">
                    {exhibition.title}
                  </h1>
                  {exhibition.intro && (
                    <p className="mt-6 max-h-[28vh] overflow-y-auto whitespace-pre-wrap break-words text-sm leading-7 text-white/72 no-scrollbar md:max-w-lg">
                      {exhibition.intro}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => scrollToScene(1)}
                    className="mt-8 inline-flex items-center gap-3 border border-[#f1d27a]/60 bg-[#f1d27a] px-6 py-3 text-sm font-bold text-[#191611] shadow-[0_16px_50px_rgba(0,0,0,0.32)] active:scale-95"
                  >
                    开始浏览
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              <div className="absolute bottom-24 right-6 z-10 hidden items-center gap-3 text-[#fff4d3] md:flex">
                <Mouse size={18} />
                <span className="font-serif text-sm font-bold tracking-[0.18em]">横向滚动浏览展厅</span>
              </div>
            </section>

            {safeArtifacts.map((artifact, index) => {
              const theme = sceneThemes[index % sceneThemes.length];
              const image = String(artifactImageUrlRaw(artifact) ?? '');
              const name = displayDbString(artifactNameRaw(artifact));
              const museum = displayDbString(artifactMuseumRaw(artifact));
              const era = displayDbString(artifactEraRaw(artifact));
              const description = displayDbString(artifactDescriptionRaw(artifact));

              return (
                <section
                  key={`immersive-scene-${artifact.id}`}
                  className={cn(
                    'relative grid h-full w-screen snap-start overflow-hidden bg-gradient-to-br px-5 pb-28 pt-20 md:grid-cols-[minmax(280px,0.92fr)_minmax(360px,0.8fr)] md:items-center md:gap-10 md:px-16 md:pb-24',
                    theme.wall,
                  )}
                >
                  <SafeImage src={image} className="absolute inset-0 h-full w-full scale-110 object-cover opacity-12 blur-2xl" />
                  <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/45 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/55 to-transparent" />
                  <div className="pointer-events-none absolute left-[10vw] top-[12vh] h-[60vh] w-px bg-white/14" />
                  <div className="pointer-events-none absolute right-[12vw] top-[18vh] h-[42vh] w-px bg-white/10" />

                  <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ root: viewportRef, amount: 0.45 }}
                    transition={{ duration: 0.6 }}
                    className="relative z-10 mx-auto flex h-[48vh] w-full max-w-[min(68vh,520px)] items-center justify-center md:h-[68vh]"
                  >
                    <div className={cn('relative h-full w-full border-[10px] border-[#2c2119] p-4 shadow-[0_40px_120px_rgba(0,0,0,0.46)]', theme.panel)}>
                      <div className="absolute -left-5 top-10 h-20 w-5 bg-black/20" />
                      <div className="absolute -right-5 bottom-10 h-20 w-5 bg-black/20" />
                      <SafeImage src={image} className="h-full w-full object-contain bg-black/5" />
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: 28 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ root: viewportRef, amount: 0.45 }}
                    transition={{ duration: 0.7, delay: 0.08 }}
                    className="relative z-10 mx-auto mt-6 flex w-full max-w-xl gap-5 md:mt-0"
                  >
                    <div className="hidden shrink-0 flex-col items-center gap-3 md:flex">
                      <span className="font-serif text-[11px] font-bold tracking-[0.32em] text-white/50 [writing-mode:vertical-rl]">
                        CHAPTER {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="h-20 w-px bg-white/28" />
                    </div>
                    <div className="min-w-0">
                      <div className="mb-4 flex items-center gap-2 text-white/58">
                        <Map size={16} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.22em]">
                          {museum} · {era}
                        </span>
                      </div>
                      <h2 className={cn('break-words font-serif text-3xl font-bold leading-tight md:text-5xl', theme.text)}>
                        {name}
                      </h2>
                      {settings.showIntro && (
                        <p className="mt-6 max-h-[26vh] overflow-y-auto whitespace-pre-wrap break-words text-sm font-light leading-7 text-white/74 no-scrollbar">
                          {description || '这件展品的资料仍在整理中。'}
                        </p>
                      )}
                      <div className="mt-7 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={goPrev}
                          className="flex h-10 w-10 items-center justify-center border border-white/16 bg-white/10 backdrop-blur-md active:scale-95 disabled:opacity-30"
                          disabled={currentIndex === 0}
                        >
                          <ChevronLeft size={20} />
                        </button>
                        <button
                          type="button"
                          onClick={goNext}
                          className="flex h-10 w-10 items-center justify-center border border-white/16 bg-white/10 backdrop-blur-md active:scale-95"
                        >
                          <ChevronRight size={20} />
                        </button>
                        <span className="text-xs font-bold text-white/45">
                          {index + 1} / {safeArtifacts.length}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                </section>
              );
            })}
          </div>
        </div>

        <div className="absolute left-0 right-0 top-0 z-30 flex items-start justify-between px-4 py-4 md:px-7 md:py-6">
          <div className="min-w-0 pr-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/45">MuseLink</p>
            <p className="mt-1 max-w-[64vw] truncate font-serif text-sm font-bold text-white/85">{exhibition.title}</p>
          </div>
          <div className="flex items-center gap-2">
            {activeBgmUrl && (
              <button
                type="button"
                onClick={toggleAudio}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-black/25 text-white backdrop-blur-md transition-all active:scale-95',
                  isAudioPlaying && !isMuted && 'animate-spin',
                )}
                style={isAudioPlaying && !isMuted ? { animationDuration: '3s' } : undefined}
                aria-label={isAudioPlaying && !isMuted ? '暂停背景音乐' : '播放背景音乐'}
              >
                {isMuted || !isAudioPlaying ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
            )}
            <button
              type="button"
              onClick={() => setAutoRoam((value) => !value)}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-black/25 text-white backdrop-blur-md transition-all active:scale-95',
                autoRoam && 'bg-[#f1d27a] text-black',
              )}
              aria-label={autoRoam ? '暂停自动浏览' : '自动浏览'}
            >
              {autoRoam ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-black/25 text-white backdrop-blur-md transition-all active:scale-95"
              aria-label="关闭沉浸展览"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-30 px-4 pb-5 pt-12 md:px-10">
          <div className="mx-auto max-w-6xl">
            <div className="mb-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.22em] text-white/48">
              <span>{currentIndex === 0 ? 'Home' : `Scene ${String(currentIndex).padStart(2, '0')}`}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="relative h-2 rounded-full bg-white/25">
              <motion.div
                className="absolute left-0 top-0 h-full rounded-full bg-[#e62b17]"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.24 }}
              />
              {Array.from({ length: sceneCount }).map((_, index) => {
                const artifact = safeArtifacts[index - 1];
                const left = sceneCount <= 1 ? 4 : 4 + (index / (sceneCount - 1)) * 92;
                return (
                  <button
                    key={`tour-node-${index}`}
                    type="button"
                    onClick={() => scrollToScene(index)}
                    className={cn(
                      'group absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-white shadow-[0_0_0_4px_rgba(255,255,255,0.12)] transition-all',
                      index === currentIndex && 'bg-[#e62b17] shadow-[0_0_0_6px_rgba(230,43,23,0.22)]',
                    )}
                    style={{ left: `${left}%` }}
                    aria-label={index === 0 ? '展览首页' : `第 ${index} 个展品`}
                  >
                    {artifact && (
                      <span className="pointer-events-none absolute bottom-7 left-1/2 hidden w-36 -translate-x-1/2 overflow-hidden border border-white/12 bg-black/80 p-1 text-left shadow-2xl backdrop-blur-md group-hover:block">
                        <SafeImage src={String(artifactImageUrlRaw(artifact) ?? '')} className="h-20 w-full object-cover" />
                        <span className="block truncate px-2 py-1 text-[10px] font-bold text-white">
                          {displayDbString(artifactNameRaw(artifact))}
                        </span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
