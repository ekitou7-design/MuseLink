import { useMemo, useRef, useState } from "react";
import { motion, type PanInfo } from "motion/react";
import { Images, Library, UserRound } from "lucide-react";
import type { Exhibition } from "../../../types";
import { SafeImage } from "../../../components/SafeImage";
import { normalizeSwipeExhibitionSnapshot, type SwipeAction } from "../utils/preferenceProfile";

const SWIPE_THRESHOLD = 110;
const CLICK_DRAG_TOLERANCE = 8;

type SwipeExhibitionCardProps = {
  exhibition: Exhibition;
  onSwipe: (action: Extract<SwipeAction, "interested" | "dislike">) => void;
  onOpenDetail: () => void;
};

export function SwipeExhibitionCard({ exhibition, onSwipe, onOpenDetail }: SwipeExhibitionCardProps) {
  const [dragX, setDragX] = useState(0);
  const maxDragRef = useRef(0);
  const snapshot = useMemo(() => normalizeSwipeExhibitionSnapshot(exhibition), [exhibition]);
  const rotate = Math.max(-10, Math.min(10, dragX / 18));
  const likeOpacity = Math.min(1, Math.max(0, dragX / SWIPE_THRESHOLD));
  const dislikeOpacity = Math.min(1, Math.max(0, -dragX / SWIPE_THRESHOLD));

  const onDrag = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setDragX(info.offset.x);
    maxDragRef.current = Math.max(maxDragRef.current, Math.abs(info.offset.x), Math.abs(info.offset.y));
  };

  const onDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x > SWIPE_THRESHOLD) {
      onSwipe("interested");
      return;
    }
    if (info.offset.x < -SWIPE_THRESHOLD) {
      onSwipe("dislike");
      return;
    }
    setDragX(0);
  };

  return (
    <motion.article
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.22}
      onPointerDown={() => {
        maxDragRef.current = 0;
      }}
      onDrag={onDrag}
      onDragEnd={onDragEnd}
      onClick={(event) => {
        if (maxDragRef.current > CLICK_DRAG_TOLERANCE) {
          event.preventDefault();
          return;
        }
        onOpenDetail();
      }}
      animate={{ x: dragX, rotate }}
      transition={{ type: "spring", stiffness: 360, damping: 28 }}
      className="relative mx-auto flex h-[min(68svh,590px)] w-full max-w-[420px] cursor-grab touch-pan-y select-none flex-col overflow-hidden rounded-[8px] border border-black/5 bg-white shadow-2xl shadow-stone-900/12 active:cursor-grabbing"
    >
      <div className="pointer-events-none absolute left-4 top-4 z-20 rounded-[5px] border-2 border-rose-500 bg-white/80 px-3 py-1.5 text-sm font-black text-rose-600 shadow-sm backdrop-blur-md" style={{ opacity: dislikeOpacity }}>
        不感兴趣
      </div>
      <div className="pointer-events-none absolute right-4 top-4 z-20 rounded-[5px] border-2 border-emerald-600 bg-white/80 px-3 py-1.5 text-sm font-black text-emerald-700 shadow-sm backdrop-blur-md" style={{ opacity: likeOpacity }}>
        感兴趣
      </div>

      <div className="relative min-h-0 flex-[1.25] bg-[#eee8dd]">
        <SafeImage
          src={snapshot.coverUrl}
          alt={snapshot.title}
          width={840}
          height={960}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/65 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3 text-white">
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-white/75">
              <Library size={13} />
              Exhibition Swipe
            </p>
            <h2 className="mt-1 line-clamp-2 break-words text-2xl font-black leading-tight">{snapshot.title}</h2>
          </div>
          <span className="flex flex-shrink-0 items-center gap-1 rounded-full bg-white/18 px-2.5 py-1 text-[10px] font-black backdrop-blur-md">
            <Images size={13} />
            {snapshot.artifactCount} 件
          </span>
        </div>
      </div>

      <div className="flex min-h-[210px] flex-col gap-3 p-5">
        <div className="flex min-w-0 items-center gap-2 text-xs font-bold text-gray-500">
          <UserRound size={15} className="flex-shrink-0 text-primary" />
          <span className="line-clamp-1">{snapshot.curatorName}</span>
        </div>
        <p className="line-clamp-5 break-words text-sm leading-relaxed text-gray-600">
          {snapshot.intro || "暂无展陈简介"}
        </p>
        <div className="mt-auto grid grid-cols-2 gap-2 text-[11px] font-bold text-gray-600">
          <div className="rounded-[5px] bg-[#F6F3EE] px-2.5 py-2">
            <span className="block text-[9px] text-gray-400">展品数量</span>
            <span>{snapshot.artifactCount} 件</span>
          </div>
          <div className="rounded-[5px] bg-[#F6F3EE] px-2.5 py-2">
            <span className="block text-[9px] text-gray-400">状态</span>
            <span>{snapshot.isPublic ? "公开展陈" : "个人展陈"}</span>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
