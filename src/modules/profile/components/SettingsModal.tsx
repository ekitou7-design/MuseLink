import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  Globe,
  Palette,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { cn } from '../../../lib/utils';

export const SettingsModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div 
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        className="fixed inset-0 z-[200] bg-gray-50 flex flex-col"
      >
        <div className="p-4 flex items-center gap-4 bg-white border-b border-gray-100">
          <button onClick={onClose} className="p-2 text-gray-400"><ArrowLeft size={24} /></button>
          <h2 className="text-lg font-bold">通用设置</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2">基础设置</h4>
            <div className="bg-white rounded-3xl overflow-hidden border border-gray-100">
              {[
                { icon: Globe, label: '语言设置', value: '简体中文' },
                { icon: Palette, label: '深色模式', value: '跟随系统' },
                { icon: Bell, label: '消息推送', value: '已开启' },
              ].map((item) => (
                <div key={item.label} className={cn("flex items-center justify-between p-4", item.label !== '语言设置' && "border-t border-gray-50")}>
                  <div className="flex items-center gap-3">
                    <item.icon size={18} className="text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <span className="text-xs">{item.value}</span>
                    <ChevronRight size={14} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2">隐私与安全</h4>
            <div className="bg-white rounded-3xl overflow-hidden border border-gray-100">
              {[
                { icon: ShieldCheck, label: '隐私设置' },
                { icon: Smartphone, label: '账号安全' },
              ].map((item) => (
                <div key={item.label} className={cn("flex items-center justify-between p-4", item.label !== '隐私设置' && "border-t border-gray-50")}>
                  <div className="flex items-center gap-3">
                    <item.icon size={18} className="text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">{item.label}</span>
                  </div>
                  <ChevronRight size={14} className="text-gray-400" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);
