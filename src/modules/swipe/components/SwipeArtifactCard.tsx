import { useMemo, useRef, useState } from "react";
import { motion, type PanInfo } from "motion/react";
import { Building2, Layers, Sparkles } from "lucide-react";
import type { Artifact } from "../../../types";
import { SafeImage } from "../../../components/SafeImage";
import { cn } from "../../../lib/utils";
import { normalizeSwipeArtifactSnapshot, type SwipeAction } from "../utils/preferenceProfile";

const SWIPE_THRESHOLD = 110;
const CLICK_DRAG_TOLERANCE = 8;

type SwipeArtifactCardProps = {
  artifact: Artifact;
  onSwipe: (action: Extract<SwipeAction, "interested" | "dislike">) => void;
  onOpenDetail: () => void;
};

export function SwipeArtifactCard({ artifact, onSwipe, onOpenDetail }: SwipeArtifactCardProps) {
  const [dragX, setDragX] = useState(0);
  const maxDragRef = useRef(0);
  const snapshot = useMemo(() => normalizeSwipeArtifactSnapshot(artifact), [artifact]);
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

      <div className="relative min-h-0 flex-[1.2] bg-[#eee8dd]">
        <SafeImage
          src={snapshot.imageUrl}
          alt={snapshot.name}
          width={840}
          height={960}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/55 to-transparent" />
      </div>

      <div className="flex min-h-[230px] flex-col gap-3 p-5">
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-primary">
            <Sparkles size={13} />
            Artifact Swipe
          </p>
          <h2 className="break-words text-2xl font-black leading-tight text-gray-950">{snapshot.name || "未命名文物"}</h2>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] font-bold text-gray-600">
          <div className="min-w-0 rounded-[5px] bg-[#F6F3EE] px-2.5 py-2">
            <span className="block text-[9px] text-gray-400">朝代 / 年代</span>
            <span className="line-clamp-1">{snapshot.dynasty || "暂无信息"}</span>
          </div>
          <div className="min-w-0 rounded-[5px] bg-[#F6F3EE] px-2.5 py-2">
            <span className="block text-[9px] text-gray-400">类型 / 分类</span>
            <span className="line-clamp-1">{snapshot.category || "暂无信息"}</span>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-2 text-xs font-bold text-gray-500">
          <Building2 size={15} className="flex-shrink-0 text-primary" />
          <span className="line-clamp-1">{snapshot.museum || "暂无馆藏地"}</span>
        </div>

        <p className="line-clamp-3 break-words text-sm leading-relaxed text-gray-600">
          {snapshot.summary || "暂无简介"}
        </p>

        {snapshot.tags.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1.5">
            {snapshot.tags.slice(0, 4).map((tag) => (
              <span key={tag} className={cn("max-w-full truncate rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800")}>
                <Layers size={11} className="mr-1 inline-block" />
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.article>
  );
}
