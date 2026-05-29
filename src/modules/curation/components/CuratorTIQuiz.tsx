import { useEffect, useState } from 'react';
import { Loader2, Save, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { CuratorTI } from '../../../types';
import { cn } from '../../../lib/utils';
import {
  calculateCuratorTI,
  CURATOR_GUIDE_QUESTIONS,
  type CuratorGuideAnswers,
} from '../data/curatorPreferences';

export const CuratorTIQuiz = ({
  isOpen,
  initialAnswers,
  isSaving,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  initialAnswers?: CuratorGuideAnswers;
  isSaving: boolean;
  onClose: () => void;
  onSave: (result: CuratorTI) => void;
}) => {
  const [answers, setAnswers] = useState<CuratorGuideAnswers>(initialAnswers || {});
  const result = calculateCuratorTI(answers);

  useEffect(() => {
    if (isOpen) {
      setAnswers(initialAnswers || {});
    }
  }, [initialAnswers, isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          className="fixed inset-0 z-[220] flex flex-col bg-white"
        >
          <div className="flex items-center justify-between border-b border-gray-100 p-4">
            <button onClick={onClose} className="p-2 text-gray-400">
              <X size={22} />
            </button>
            <div className="text-center">
              <h2 className="text-base font-bold text-gray-900">策展 TI 测试</h2>
              <p className="text-[10px] font-bold text-gray-400">生成你的个人策展画像</p>
            </div>
            <div className="w-9" />
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-4 no-scrollbar">
            {result && (
              <div className="rounded-[5px] border border-amber-100 bg-amber-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">当前画像</p>
                <div className="mt-2 flex items-center gap-3">
                  <span className="rounded-[5px] bg-amber-800 px-3 py-1.5 text-sm font-bold text-white">{result.code}</span>
                  <h3 className="min-w-0 flex-1 break-words text-sm font-bold text-gray-900">{result.title}</h3>
                </div>
                <p className="mt-2 break-words text-xs leading-relaxed text-amber-900/75">{result.description}</p>
              </div>
            )}

            {CURATOR_GUIDE_QUESTIONS.map((question) => (
              <section key={question.id} className="space-y-3 rounded-[5px] border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="rounded-[5px] bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-500">{question.title}</span>
                  <h3 className="break-words text-sm font-bold leading-snug text-gray-900">{question.prompt}</h3>
                </div>
                <div className="space-y-2">
                  {question.options.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: option.id }))}
                      className={cn(
                        'w-full rounded-[5px] border px-3 py-2.5 text-left text-xs font-bold leading-relaxed transition-all',
                        answers[question.id] === option.id
                          ? 'border-amber-700 bg-amber-50 text-amber-900'
                          : 'border-gray-100 bg-gray-50 text-gray-600',
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="border-t border-gray-100 bg-white p-4">
            <button
              onClick={() => result && onSave(result)}
              disabled={!result || isSaving}
              className="flex w-full items-center justify-center gap-2 rounded-[5px] bg-amber-800 py-3 text-sm font-bold text-white shadow-lg shadow-amber-800/20 disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              保存策展 TI
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
