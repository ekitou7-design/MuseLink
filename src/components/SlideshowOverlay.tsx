import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  Headphones,
  Landmark,
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
    wall: 'from-[#100d09] via-[#2b2418] to-[#050403]',
    panel: 'bg-[#f5ebd7]',
    accent: '#f1d27a',
    text: 'text-[#fff4d3]',
  },
  {
    wall: 'from-[#070b0e] via-[#1d2a31] to-[#050607]',
    panel: 'bg-[#eef3f3]',
    accent: '#d6b36a',
    text: 'text-[#f3dfad]',
  },
  {
    wall: 'from-[#140806] via-[#3a1f18] to-[#090403]',
    panel: 'bg-[#f3dfc9]',
    accent: '#efbd7a',
    text: 'text-[#ffe4c3]',
  },
  {
    wall: 'from-[#0a0810] via-[#272133] to-[#050408]',
    panel: 'bg-[#eee8f5]',
    accent: '#d8bd72',
    text: 'text-[#f3dfad]',
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
  const artifactNotes = exhibition.aiCuration?.artifactNotes || {};

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
        style={{ top: 'var(--app-status-bar-height)' }}
      >
        {!hasAmbientBgm && activeBgmUrl && <audio ref={audioRef} src={activeBgmUrl} loop muted={isMuted} />}

        <div
          ref={viewportRef}
          onScroll={handleScroll}
          className="h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth no-scrollbar"
        >
          <div className="flex h-full w-full">
            <section className="relative h-full min-w-full snap-start overflow-hidden bg-[#080604]">
              <SafeImage src={coverImage} className="absolute inset-0 h-full w-full scale-105 object-cover opacity-52" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.46),rgba(0,0,0,0.78)_45%,rgba(0,0,0,0.94))]" />
              <div className="absolute left-1/2 top-0 h-[56%] w-[72%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,rgba(242,205,132,0.36),transparent_68%)]" />
              <div className="absolute left-[14%] top-0 h-[72%] w-px rotate-12 bg-gradient-to-b from-[#f6d58d]/30 to-transparent" />
              <div className="absolute right-[18%] top-0 h-[64%] w-px -rotate-12 bg-gradient-to-b from-[#f6d58d]/20 to-transparent" />
              <div className="absolute inset-x-8 bottom-24 h-px bg-gradient-to-r from-transparent via-[#d8bd72]/45 to-transparent" />

              <div className="relative z-10 flex h-full min-h-0 flex-col justify-end px-5 pb-32 pt-20 md:px-12">
                <motion.div
                  initial={{ opacity: 0, y: 26 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7 }}
                  className="flex max-h-[calc(100%-1rem)] min-h-0 max-w-full flex-col gap-4 overflow-hidden rounded-[5px] border border-[#d8bd72]/22 bg-black/42 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.58)] backdrop-blur-xl"
                >
                  <div className="flex shrink-0 items-center justify-between gap-3">
                    <div className="inline-flex min-w-0 items-center gap-2 border border-[#d8bd72]/28 bg-[#d8bd72]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[#f3dfad] force-nowrap">
                      <Headphones size={16} />
                      Immersive Exhibition
                    </div>
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.22em] text-white/42">
                      {safeArtifacts.length} Objects
                    </span>
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col gap-4">
                    <h1 className="max-h-[32vh] max-w-full overflow-y-auto whitespace-normal break-words font-serif text-3xl font-bold leading-tight text-[#fff4d3] no-scrollbar [overflow-wrap:anywhere] md:text-5xl">
                      {exhibition.title}
                    </h1>
                    {exhibition.intro && (
                      <p className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-7 text-white/70 no-scrollbar [overflow-wrap:anywhere]">
                        {exhibition.intro}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => scrollToScene(1)}
                    className="inline-flex h-12 shrink-0 items-center justify-center gap-3 border border-[#f1d27a]/70 bg-[#f1d27a] px-5 text-sm font-bold text-[#16110a] shadow-[0_18px_56px_rgba(0,0,0,0.42)] active:scale-95"
                  >
                    开始浏览
                    <ChevronRight size={18} />
                  </button>
                </motion.div>
              </div>
            </section>

            {safeArtifacts.map((artifact, index) => {
              const theme = sceneThemes[index % sceneThemes.length];
              const image = String(artifactImageUrlRaw(artifact) ?? '');
              const name = displayDbString(artifactNameRaw(artifact));
              const museum = displayDbString(artifactMuseumRaw(artifact));
              const era = displayDbString(artifactEraRaw(artifact));
              const description = displayDbString(artifactDescriptionRaw(artifact));
              const note = artifactNotes[artifact.id] || description || '这件展品的资料仍在整理中。';

              return (
                <section
                  key={`immersive-scene-${artifact.id}`}
                  className={cn(
                    'relative flex h-full min-w-full snap-start flex-col overflow-hidden bg-gradient-to-br px-5 pb-24 pt-16',
                    theme.wall,
                  )}
                >
                  <SafeImage src={image} className="absolute inset-0 h-full w-full scale-125 object-cover opacity-10 blur-2xl" />
                  <div className="absolute inset-x-0 top-0 h-[42%] bg-[radial-gradient(ellipse_at_top,rgba(246,213,141,0.28),transparent_68%)]" />
                  <div className="absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-black/80 to-transparent" />
                  <div className="pointer-events-none absolute left-[12%] top-[8%] h-[58%] w-px bg-gradient-to-b from-[#f6d58d]/30 to-transparent" />
                  <div className="pointer-events-none absolute right-[14%] top-[10%] h-[46%] w-px bg-gradient-to-b from-white/16 to-transparent" />

                  <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ root: viewportRef, amount: 0.45 }}
                    transition={{ duration: 0.6 }}
                    className="relative z-10 flex min-h-0 flex-[0.95] items-center justify-center pt-4"
                  >
                    <div className="relative flex h-full max-h-[42vh] w-full items-center justify-center">
                      <div className="absolute left-1/2 top-[-12%] h-[34%] w-[62%] -translate-x-1/2 rounded-full bg-[#f6d58d]/26 blur-2xl" />
                      <div className="absolute bottom-1 h-7 w-[72%] rounded-full bg-black/50 blur-xl" />
                      <div className="relative flex h-full w-[82%] items-center justify-center border border-[#f4d487]/28 bg-white/[0.055] p-3 shadow-[0_34px_110px_rgba(0,0,0,0.62)] backdrop-blur-md">
                        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.18),transparent_32%,rgba(255,255,255,0.05)_62%,transparent)]" />
                        <div className="absolute -left-2 top-8 h-20 w-2 bg-[#f4d487]/18" />
                        <div className="absolute -right-2 bottom-8 h-20 w-2 bg-black/32" />
                        <SafeImage src={image} className="relative z-10 h-full w-full object-contain bg-black/10" />
                      </div>
                      <div className="absolute bottom-0 h-3 w-[58%] border border-[#d8bd72]/20 bg-black/50 shadow-[0_12px_34px_rgba(0,0,0,0.5)]" />
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 22 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ root: viewportRef, amount: 0.45 }}
                    transition={{ duration: 0.7, delay: 0.08 }}
                    className="relative z-10 mt-3 flex max-h-[34vh] min-h-0 shrink-0 flex-col rounded-[5px] border border-[#d8bd72]/24 bg-black/56 p-4 shadow-[0_26px_80px_rgba(0,0,0,0.56)] backdrop-blur-xl"
                  >
                    <div className="mb-3 flex min-h-0 shrink-0 items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="mb-2 flex items-center gap-2 text-[#d8bd72]/78">
                          <Landmark size={16} />
                          <span className="truncate text-[10px] font-bold uppercase tracking-[0.18em]">
                            {museum} · {era}
                          </span>
                        </div>
                        <h2 className={cn('max-h-20 overflow-y-auto break-words font-serif text-xl font-bold leading-tight no-scrollbar [overflow-wrap:anywhere]', theme.text)}>
                          {name}
                        </h2>
                      </div>
                      <span className="shrink-0 border border-[#d8bd72]/24 px-2 py-1 text-[10px] font-bold tracking-[0.18em] text-[#d8bd72]/75">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    </div>
                    {settings.showIntro && (
                      <p className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-6 text-white/68 no-scrollbar [overflow-wrap:anywhere]">
                        {note}
                      </p>
                    )}
                    <div className="mt-4 flex shrink-0 items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={goPrev}
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d8bd72]/24 bg-white/8 text-[#f3dfad] backdrop-blur-md active:scale-95 disabled:opacity-30"
                          disabled={currentIndex === 0}
                        >
                          <ChevronLeft size={20} />
                        </button>
                        <button
                          type="button"
                          onClick={goNext}
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d8bd72]/24 bg-white/8 text-[#f3dfad] backdrop-blur-md active:scale-95"
                        >
                          <ChevronRight size={20} />
                        </button>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/42">
                        {index + 1} / {safeArtifacts.length}
                      </span>
                    </div>
                  </motion.div>
                </section>
              );
            })}
          </div>
        </div>

        <div className="absolute left-0 right-0 top-0 z-30 flex items-start justify-between px-4 py-4 md:px-7 md:py-6">
          <div className="min-w-0 pr-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#d8bd72]/58">MuseLink Gallery</p>
            <p className="mt-1 max-w-[64%] truncate font-serif text-sm font-bold text-white/82">{exhibition.title}</p>
          </div>
          <div className="flex items-center gap-2">
            {activeBgmUrl && (
              <button
                type="button"
                onClick={toggleAudio}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border border-[#d8bd72]/18 bg-black/36 text-[#f3dfad] shadow-[0_12px_34px_rgba(0,0,0,0.32)] backdrop-blur-xl transition-all active:scale-95',
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
                'flex h-10 w-10 items-center justify-center rounded-full border border-[#d8bd72]/18 bg-black/36 text-[#f3dfad] shadow-[0_12px_34px_rgba(0,0,0,0.32)] backdrop-blur-xl transition-all active:scale-95',
                autoRoam && 'bg-[#f1d27a] text-black',
              )}
              aria-label={autoRoam ? '暂停自动浏览' : '自动浏览'}
            >
              {autoRoam ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d8bd72]/18 bg-black/36 text-[#f3dfad] shadow-[0_12px_34px_rgba(0,0,0,0.32)] backdrop-blur-xl transition-all active:scale-95"
              aria-label="关闭沉浸展览"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-30 px-4 pb-5 pt-10 md:px-10">
          <div className="mx-auto rounded-[5px] border border-[#d8bd72]/16 bg-black/36 p-3 shadow-[0_20px_70px_rgba(0,0,0,0.44)] backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-[#f3dfad]/50">
              <span>{currentIndex === 0 ? 'Home' : `Scene ${String(currentIndex).padStart(2, '0')}`}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="relative h-px bg-[#d8bd72]/26">
              <motion.div
                className="absolute left-0 top-0 h-full bg-[#f1d27a]"
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
                      'group absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#d8bd72]/70 bg-[#120e09] shadow-[0_0_0_4px_rgba(216,189,114,0.10)] transition-all',
                      index === currentIndex && 'h-4 w-4 bg-[#f1d27a] shadow-[0_0_0_7px_rgba(241,210,122,0.18)]',
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
