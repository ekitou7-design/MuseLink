import { AnimatePresence, motion } from 'motion/react';
import { Info } from 'lucide-react';

export const NotDevelopedModal = ({ isOpen, onClose, title }: { isOpen: boolean, onClose: () => void, title: string }) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div 
          initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
          className="bg-white rounded-[5px] p-8 max-w-sm w-full shadow-2xl text-center space-y-4"
          onClick={e => e.stopPropagation()}
        >
          <div className="w-16 h-16 bg-neutral rounded-2xl flex items-center justify-center text-primary mx-auto">
            <Info size={32} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-secondary font-serif">{title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">此功能暂未开发，敬请期待</p>
          </div>
          <button 
            onClick={onClose}
            className="w-full py-3.5 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20"
          >
            我知道了
          </button>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);
