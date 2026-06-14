import { BookmarkCheck, RotateCcw, User } from "lucide-react";
import type { SwipeRoundStats, UserPreferenceProfile } from "../utils/preferenceProfile";
import { topPositiveKey } from "../utils/preferenceProfile";

type SwipeSummaryPanelProps = {
  mode: "artifact" | "exhibition";
  stats: SwipeRoundStats;
  profile: UserPreferenceProfile;
  onRestart: () => void;
  onViewFavorites: () => void;
};

export function SwipeSummaryPanel({
  mode,
  stats,
  profile,
  onRestart,
  onViewFavorites,
}: SwipeSummaryPanelProps) {
  const topDynasty = topPositiveKey(profile.dynastyScores);
  const topCategory = topPositiveKey(profile.categoryScores);

  return (
    <section className="mx-auto flex w-full max-w-[420px] flex-col gap-5 rounded-[8px] border border-black/5 bg-white p-5 shadow-xl shadow-stone-900/8">
      <div className="space-y-2 text-center">
        <p className="text-[10px] font-black uppercase tracking-widest text-primary">Swipe Summary</p>
        <h2 className="text-2xl font-black leading-tight text-gray-950">让推荐更懂你</h2>
        <p className="text-xs leading-relaxed text-gray-500">
          {mode === "artifact" ? "这轮文物偏好已经更新到本地画像。" : "这轮展陈反馈已经记录，后续可用于展陈推荐。"}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-[5px] bg-emerald-50 p-3 text-center">
          <p className="text-xl font-black text-emerald-700">{stats.interested}</p>
          <p className="mt-1 text-[10px] font-bold text-emerald-800">感兴趣</p>
        </div>
        <div className="rounded-[5px] bg-rose-50 p-3 text-center">
          <p className="text-xl font-black text-rose-600">{stats.dislike}</p>
          <p className="mt-1 text-[10px] font-bold text-rose-700">不感兴趣</p>
        </div>
        <div className="rounded-[5px] bg-amber-50 p-3 text-center">
          <p className="text-xl font-black text-amber-800">{stats.favorite}</p>
          <p className="mt-1 text-[10px] font-bold text-amber-900">收藏</p>
        </div>
      </div>

      {mode === "artifact" && (
        <div className="grid grid-cols-2 gap-2 text-xs font-bold text-gray-600">
          <div className="rounded-[5px] bg-[#F6F3EE] p-3">
            <p className="text-[10px] text-gray-400">目前最偏好的朝代</p>
            <p className="mt-1 line-clamp-1 text-gray-950">{topDynasty || "继续刷几件看看"}</p>
          </div>
          <div className="rounded-[5px] bg-[#F6F3EE] p-3">
            <p className="text-[10px] text-gray-400">目前最偏好的类型</p>
            <p className="mt-1 line-clamp-1 text-gray-950">{topCategory || "继续刷几件看看"}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onRestart}
          className="flex min-h-12 items-center justify-center gap-2 rounded-[5px] bg-primary px-3 text-xs font-black text-white shadow-lg shadow-primary/20 active:scale-[0.98]"
        >
          <RotateCcw size={16} />
          继续刷一轮
        </button>
        <button
          type="button"
          onClick={onViewFavorites}
          className="flex min-h-12 items-center justify-center gap-2 rounded-[5px] border border-gray-100 bg-[#F6F3EE] px-3 text-xs font-black text-gray-800 active:scale-[0.98]"
        >
          {mode === "artifact" ? <BookmarkCheck size={16} /> : <User size={16} />}
          {mode === "artifact" ? "查看收藏" : "去个人页"}
        </button>
      </div>
    </section>
  );
}
