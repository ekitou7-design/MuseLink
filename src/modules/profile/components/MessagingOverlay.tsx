import { ArrowLeft, AtSign, Bell, Heart, MessageCircle, MessageSquare, UserPlus } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../../lib/utils';

export const MessagingOverlay = ({
  setIsMessaging,
  messageTab,
  setMessageTab,
}: {
  setIsMessaging: (value: boolean) => void,
  messageTab: 'reminders' | 'chats',
  setMessageTab: (tab: 'reminders' | 'chats') => void,
}) => (
  <motion.div
    key="messaging-overlay"
    initial={{ x: '100%' }}
    animate={{ x: 0 }}
    exit={{ x: '100%' }}
    className="fixed inset-0 z-[100] flex flex-col bg-[var(--app-page-bg)]"
    style={{ top: 'var(--app-status-bar-height)' }}
  >
    <div className="ios-title-bar flex items-center gap-4 border-b border-black/5 bg-[var(--app-bar-bg)] px-4 backdrop-blur-xl">
      <button onClick={() => setIsMessaging(false)} className="p-2 text-gray-400"><ArrowLeft size={20} /></button>
      <h2 className="text-lg font-bold">消息</h2>
    </div>
    <div className="ios-mid-bar flex">
      <button 
        onClick={() => setMessageTab('reminders')}
        className={cn("flex-1 py-4 text-sm font-bold transition-all", messageTab === 'reminders' ? "text-amber-800 border-b-2 border-amber-800" : "text-gray-400")}
      >
        提醒栏
      </button>
      <button 
        onClick={() => setMessageTab('chats')}
        className={cn("flex-1 py-4 text-sm font-bold transition-all", messageTab === 'chats' ? "text-amber-800 border-b-2 border-amber-800" : "text-gray-400")}
      >
        私信栏
      </button>
    </div>
    
    <div className="flex-1 overflow-y-auto">
      {messageTab === 'reminders' ? (
        <div className="p-6 space-y-6">
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {[
              { icon: Heart, label: '赞和收藏', color: 'bg-rose-50 text-rose-500' },
              { icon: MessageCircle, label: '评论', color: 'bg-blue-50 text-blue-500' },
              { icon: AtSign, label: '@我的', color: 'bg-green-50 text-green-500' },
              { icon: UserPlus, label: '新增关注', color: 'bg-amber-50 text-amber-500' },
            ].map(item => (
              <button key={item.label} className="flex flex-col items-center gap-2 flex-shrink-0">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", item.color)}>
                  <item.icon size={20} />
                </div>
                <span className="text-[10px] font-bold text-gray-500">{item.label}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-col items-center justify-center py-20 text-gray-200 gap-4">
            <Bell size={64} strokeWidth={1} />
            <p className="text-xs font-bold text-gray-300">暂无互动提醒</p>
          </div>
        </div>
      ) : (
        <div className="p-6 space-y-6">
          <div className="bg-amber-50 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-800 rounded-xl flex items-center justify-center text-white">
              <Bell size={20} />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-amber-900">系统通知</h4>
              <p className="text-[10px] text-amber-700/70">欢迎来到博悟 MuseLink！</p>
            </div>
            <span className="text-[10px] text-amber-700/50">刚刚</span>
          </div>
          <div className="flex flex-col items-center justify-center py-20 text-gray-200 gap-4">
            <MessageSquare size={64} strokeWidth={1} />
            <p className="text-xs font-bold text-gray-300">暂无私信内容</p>
          </div>
        </div>
      )}
    </div>
  </motion.div>
);
