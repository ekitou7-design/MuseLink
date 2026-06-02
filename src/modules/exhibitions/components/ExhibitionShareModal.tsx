import { useMemo, useState } from 'react';
import { Copy, Link2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Exhibition } from '../../../types';

type ShareableExhibition = Partial<Pick<Exhibition, 'id' | 'title' | 'intro' | 'aiCuration'>>;

function getDisplayIntro(exhibition: ShareableExhibition): string {
  return exhibition.intro || exhibition.aiCuration?.opening || '这是一场由 MuseLink 生成或收藏的个人展览。';
}

function buildShareText(exhibition: ShareableExhibition): string {
  const title = exhibition.title || '我的 MuseLink 展览';
  const intro = getDisplayIntro(exhibition);
  return [
    `我在 MuseLink 发现了一场展览：《${title}》`,
    '',
    intro,
    '',
    '邀请你一起打开 MuseLink，看看这场展览的文物与策展线索。',
  ].join('\n');
}

function buildLocalLink(exhibition: ShareableExhibition): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  url.searchParams.set('share', 'exhibition');
  if (exhibition.id) {
    url.searchParams.set('exhibitionId', String(exhibition.id));
  } else {
    url.searchParams.set('preview', 'ai-generated');
  }
  return url.toString();
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export const ExhibitionShareModal = ({
  isOpen,
  exhibition,
  onClose,
}: {
  isOpen: boolean;
  exhibition: ShareableExhibition;
  onClose: () => void;
}) => {
  const [message, setMessage] = useState('');
  const shareText = useMemo(() => buildShareText(exhibition), [exhibition]);
  const localLink = useMemo(() => buildLocalLink(exhibition), [exhibition]);
  const title = exhibition.title || '我的 MuseLink 展览';
  const intro = getDisplayIntro(exhibition);

  const copyShareText = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text: shareText,
          url: localLink || undefined,
        });
        setMessage('已打开系统分享。');
        return;
      }
      await copyText(shareText);
      setMessage('分享文案已复制。');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      await copyText(shareText);
      setMessage('系统分享不可用，已复制分享文案。');
    }
  };

  const copyLocalLink = async () => {
    await copyText(localLink);
    setMessage('当前为本地预览版本，链接仅可在当前设备访问。已复制本地链接。');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[260] flex items-end bg-black/40 px-4 pb-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ y: 24, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 24, scale: 0.98 }}
            className="w-full rounded-[5px] border border-gray-100 bg-white p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary">分享展览</p>
                <h3 className="mt-1 break-words text-lg font-bold text-gray-950">{title}</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-50 text-gray-400"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mb-4 max-h-24 overflow-y-auto whitespace-pre-wrap break-words rounded-[5px] bg-gray-50 p-3 text-xs leading-6 text-gray-500 no-scrollbar">
              {intro}
            </p>

            <div className="space-y-2 rounded-[5px] border border-amber-100 bg-amber-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">推荐分享文案</p>
              <p className="max-h-36 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-6 text-amber-950 no-scrollbar">
                {shareText}
              </p>
            </div>

            <p className="mt-3 rounded-[5px] bg-gray-50 px-3 py-2 text-[10px] leading-relaxed text-gray-400">
              当前为本地预览版本，复制的链接仅可在当前设备访问。
            </p>

            {message && (
              <p className="mt-3 rounded-[5px] bg-emerald-50 px-3 py-2 text-[10px] font-bold text-emerald-700">
                {message}
              </p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={copyShareText}
                className="flex h-12 items-center justify-center gap-2 rounded-[5px] bg-primary text-xs font-bold text-white"
              >
                <Copy size={16} />
                复制分享文案
              </button>
              <button
                type="button"
                onClick={copyLocalLink}
                className="flex h-12 items-center justify-center gap-2 rounded-[5px] border border-gray-100 bg-white text-xs font-bold text-primary"
              >
                <Link2 size={16} />
                复制本地链接
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
