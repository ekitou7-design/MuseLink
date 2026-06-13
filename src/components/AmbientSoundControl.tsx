import { AnimatePresence, motion } from 'motion/react';
import { Check, Music, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AmbientAudioPlayer, DEFAULT_AMBIENT_BGM } from '../lib/ambientAudio';
import { cn } from '../lib/utils';

type SoundscapeId = 'silent' | 'gallery' | 'guqin';
type PlaybackState = 'idle' | 'playing' | 'paused';

const STORAGE_KEY = 'muselink_soundscape_preference';

const SOUNDSCAPES: Array<{
  id: SoundscapeId;
  label: string;
  description: string;
  url?: string;
  enabled: boolean;
}> = [
  { id: 'silent', label: '静默', description: '默认不播放音乐', enabled: true },
  { id: 'gallery', label: '展厅氛围', description: '很轻的空间低频环境音', url: DEFAULT_AMBIENT_BGM, enabled: true },
  { id: 'guqin', label: '古琴', description: '沉浸音景暂未开启', enabled: false },
];

function readPreference(): SoundscapeId {
  if (typeof window === 'undefined') return 'silent';
  const value = window.localStorage.getItem(STORAGE_KEY);
  return SOUNDSCAPES.some((item) => item.id === value) ? (value as SoundscapeId) : 'silent';
}

function writePreference(value: SoundscapeId) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // localStorage may be unavailable in private contexts.
  }
}

export function AmbientSoundControl({
  className,
  triggerClassName,
}: {
  className?: string;
  triggerClassName?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<SoundscapeId>(() => readPreference());
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [notice, setNotice] = useState('');
  const playerRef = useRef<AmbientAudioPlayer | null>(null);

  const selected = useMemo(
    () => SOUNDSCAPES.find((item) => item.id === selectedId) ?? SOUNDSCAPES[0],
    [selectedId],
  );

  const stopAudio = () => {
    playerRef.current?.stop();
    setPlaybackState((current) => (current === 'playing' ? 'paused' : current));
  };

  const chooseSoundscape = async (id: SoundscapeId) => {
    const option = SOUNDSCAPES.find((item) => item.id === id) ?? SOUNDSCAPES[0];
    setSelectedId(id);
    writePreference(id);
    setNotice('');

    if (option.id === selectedId && playbackState === 'playing') {
      stopAudio();
      return;
    }

    if (!option.enabled || !option.url) {
      playerRef.current?.stop();
      setPlaybackState('idle');
      setNotice(option.description || '沉浸音景暂未开启');
      return;
    }

    try {
      if (!playerRef.current) playerRef.current = new AmbientAudioPlayer();
      await playerRef.current.start(option.url);
      setPlaybackState('playing');
      setIsOpen(false);
    } catch {
      playerRef.current?.stop();
      setPlaybackState('idle');
      setNotice('当前浏览器未能启动音景');
    }
  };

  const openMenu = () => {
    setIsOpen(true);
  };

  useEffect(() => {
    return () => {
      playerRef.current?.dispose();
      playerRef.current = null;
    };
  }, []);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={openMenu}
        className={cn(
          'relative flex items-center justify-center rounded-full transition-colors',
          triggerClassName || 'h-10 w-10 bg-black/20 text-white backdrop-blur-md',
        )}
        aria-label={`音景：${selected.label}，${playbackState === 'playing' ? '播放中' : playbackState === 'paused' ? '已暂停' : '未播放'}`}
      >
        {selected.id === 'silent' ? <VolumeX size={20} /> : playbackState === 'playing' ? <Volume2 size={20} /> : <Music size={20} />}
        {playbackState === 'playing' && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-emerald-400" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.button
              type="button"
              aria-label="关闭音景菜单"
              className="fixed inset-0 z-[160] bg-black/25"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              className="fixed inset-x-4 bottom-[max(20px,env(safe-area-inset-bottom,0px))] z-[161] overflow-hidden rounded-3xl bg-white shadow-2xl"
              initial={{ y: 28, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 28, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 360 }}
            >
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <div>
                  <p className="text-sm font-black text-gray-950">沉浸音景</p>
                  <p className="mt-0.5 text-[10px] font-medium text-gray-400">
                    默认静默，选择后会记住你的偏好
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-50 text-gray-500"
                  aria-label="关闭"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-2 p-3">
                {SOUNDSCAPES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => chooseSoundscape(option.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors',
                      selectedId === option.id ? 'bg-amber-50' : 'bg-gray-50',
                    )}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-amber-800">
                      {option.id === 'silent' ? <VolumeX size={18} /> : <Music size={18} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-gray-900">{option.label}</span>
                      <span className="mt-0.5 block text-xs text-gray-500">{option.description}</span>
                    </span>
                    {selectedId === option.id ? <Check size={18} className="text-amber-800" /> : null}
                  </button>
                ))}
              </div>

              <div className="border-t border-gray-100 px-4 py-3 text-[10px] font-medium text-gray-400">
                状态：{playbackState === 'playing' ? '播放中' : playbackState === 'paused' ? '已暂停' : '未播放'}
                {notice ? <span className="ml-2 text-amber-700">{notice}</span> : null}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
