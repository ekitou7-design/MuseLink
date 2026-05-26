import { History } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

export const SyncPromptOverlay = ({
  showSyncPrompt,
  syncGuestData,
  setShowSyncPrompt,
}: {
  showSyncPrompt: boolean,
  syncGuestData: () => void,
  setShowSyncPrompt: (value: boolean) => void,
}) => (
  <AnimatePresence>
    {showSyncPrompt && (
      <motion.div 
        key="sync-prompt-overlay"
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm"
      >
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-[5px] p-8 max-w-sm w-full shadow-2xl space-y-6"
        >
          <div className="w-16 h-16 bg-neutral rounded-2xl flex items-center justify-center text-primary mx-auto">
            <History size={32} />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-xl font-bold text-secondary font-serif">同步游客数据？</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              检测到您在游客模式下的收藏记录，是否将其同步到当前账号？
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <button 
              onClick={syncGuestData}
              className="w-full py-3.5 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20"
            >
              立即同步
            </button>
            <button 
              onClick={() => {
                setShowSyncPrompt(false);
                localStorage.removeItem('muselink_favorites');
                localStorage.removeItem('muselink_history');
              }}
              className="w-full py-3.5 text-gray-400 font-bold"
            >
              暂不同步，清除本地记录
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);
