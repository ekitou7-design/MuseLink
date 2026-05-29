import { BadgeCheck, Sparkles, Wand2 } from 'lucide-react';
import type { CuratorTI } from '../../../types';

export const AICurationEntry = ({
  curatorTI,
  onOpen,
  onOpenQuiz,
}: {
  curatorTI?: CuratorTI;
  onOpen: () => void;
  onOpenQuiz: () => void;
}) => (
  <div className="space-y-3 p-3">
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800">
          <Sparkles size={14} />
          MuseLink AI Curation
        </div>
        <div className="space-y-1.5">
          <h2 className="break-words text-2xl font-bold leading-tight text-gray-900">让 AI 帮你搭起一座线上展厅</h2>
          <p className="break-words text-xs leading-relaxed text-gray-500">
            先回答几个策展引导问题，再补一句主题想法。AI 会基于后端文物库生成展品组合、叙事结构和展览文案。
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenQuiz}
        className="w-full rounded-[5px] border border-amber-100 bg-white p-3 text-left shadow-sm transition-all active:scale-[0.99]"
      >
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[5px] bg-amber-50 text-amber-800">
            <BadgeCheck size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-gray-400">我的策展 TI</p>
            {curatorTI ? (
              <>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-[5px] bg-amber-800 px-2 py-1 text-xs font-bold text-white">{curatorTI.code}</span>
                  <span className="break-words text-sm font-bold text-gray-900">{curatorTI.title}</span>
                </div>
                <p className="mt-2 break-words text-xs leading-relaxed text-gray-500">{curatorTI.description}</p>
              </>
            ) : (
              <>
                <h3 className="mt-1 text-sm font-bold text-gray-900">测一测你的策展偏好</h3>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">生成类似 MBTI 的个人策展画像，后续可以作为 AI 策展参考。</p>
              </>
            )}
          </div>
        </div>
      </button>
    </div>

    <div
      className="rounded-[5px] border border-amber-100 bg-amber-800 p-4 text-white shadow-xl shadow-amber-800/20"
    >
      <div className="mb-3 flex items-center gap-2">
        <Wand2 size={18} />
        <p className="text-sm font-bold">AI 智能策展工作台</p>
      </div>
      <button 
        onClick={onOpen}
        className="w-full rounded-[5px] bg-white py-3 text-sm font-bold text-amber-900 transition-all active:scale-95 force-nowrap"
      >
        立即生成
      </button>
    </div>
  </div>
);
