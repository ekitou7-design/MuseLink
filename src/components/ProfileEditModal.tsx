import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera, Loader2, Save } from 'lucide-react';
import { UserProfile } from '../types';
import { apiFetch } from '../lib/api';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onUpdate: (updated: Partial<UserProfile>) => void;
}

type ProfileFormData = Pick<UserProfile, 'displayName' | 'bio' | 'gender' | 'birthday' | 'location' | 'privacySettings'>;

const getProfileFormData = (profile: UserProfile): ProfileFormData => ({
  displayName: profile.displayName || '',
  bio: profile.bio || '',
  gender: profile.gender || 'secret',
  birthday: profile.birthday || '',
  location: profile.location || '',
  privacySettings: {
    profileVisibility: profile.privacySettings?.profileVisibility || 'all',
  },
});

const SafeImage = ({ src, alt, className, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  if (!src || error) {
    return (
      <div className={cn("bg-gray-100 flex flex-col items-center justify-center p-4 text-center", className)}>
        <Camera className="text-gray-300 mb-1" size={24} />
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {loading && (
        <div className="absolute inset-0 bg-gray-100 animate-pulse flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={cn(className, loading ? "opacity-0" : "opacity-100 transition-opacity duration-300")}
        onLoad={() => setLoading(false)}
        onError={() => {
          setError(true);
          setLoading(false);
        }}
        referrerPolicy="no-referrer"
        {...props}
      />
    </div>
  );
};

export const ProfileEditModal: React.FC<ProfileEditModalProps> = ({ isOpen, onClose, profile, onUpdate }) => {
  const [formData, setFormData] = useState<ProfileFormData>(() => getProfileFormData(profile));
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setFormData(getProfileFormData(profile));
      setErrorMessage('');
    }
  }, [isOpen, profile]);

  const handleSave = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const updated = await apiFetch<UserProfile>('/api/users/me/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          ...formData,
          displayName: formData.displayName.trim(),
          bio: formData.bio.trim(),
          location: formData.location?.trim() || '',
        }),
      });
      onUpdate(updated);
      onClose();
    } catch (error) {
      console.error("Update profile error:", error);
      setErrorMessage(error instanceof Error ? error.message : '资料保存失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="relative w-full max-w-2xl bg-white rounded-t-[5px] sm:rounded-[5px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-all">
                <X size={20} />
              </button>
              <h2 className="text-lg font-bold">编辑资料</h2>
              <button 
                onClick={handleSave}
                disabled={loading}
                className="px-6 py-2 bg-amber-800 text-white rounded-full text-sm font-bold flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                保存
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
              {/* Avatar & Header */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">头像与封面</h3>
                <div className="flex items-center gap-6">
                  <div className="relative group">
                    <SafeImage 
                      src={profile.photoURL || ''} 
                      alt="用户头像"
                      className="w-24 h-24 rounded-3xl object-cover border-4 border-gray-50 shadow-sm" 
                    />
                    <div className="absolute inset-0 bg-black/40 rounded-3xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <Camera className="text-white" size={24} />
                    </div>
                  </div>
                  <div className="flex-1 h-24 rounded-3xl bg-gray-100 relative group overflow-hidden">
                    <SafeImage 
                      src={profile.headerUrl || ''} 
                      alt="主页封面"
                      className="w-full h-full object-cover" 
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <Camera className="text-white" size={24} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Basic Info */}
              <div className="space-y-6">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">基础信息</h3>
                
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">昵称</label>
                  <input 
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    className="w-full bg-gray-50 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 focus:ring-amber-700/20 transition-all"
                    placeholder="2-12个字符"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">个性签名</label>
                  <textarea 
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    className="w-full bg-gray-50 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 focus:ring-amber-700/20 transition-all min-h-[100px] resize-none"
                    placeholder="介绍一下你自己吧 (0-50个字符)"
                    maxLength={50}
                  />
                </div>
              </div>

              {/* Extended Info */}
              <div className="space-y-6">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">更多信息</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">性别</label>
                    <select 
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                      className="w-full bg-gray-50 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 focus:ring-amber-700/20 transition-all appearance-none"
                    >
                      <option value="male">男</option>
                      <option value="female">女</option>
                      <option value="other">其他</option>
                      <option value="secret">保密</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">生日</label>
                    <input 
                      type="date"
                      value={formData.birthday}
                      onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                      className="w-full bg-gray-50 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 focus:ring-amber-700/20 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">所在地</label>
                  <input 
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full bg-gray-50 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 focus:ring-amber-700/20 transition-all"
                    placeholder="城市、地区"
                  />
                </div>
              </div>

              {/* Privacy */}
              <div className="space-y-6">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">隐私设置</h3>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                  <div>
                    <p className="text-sm font-bold text-gray-800">个人主页可见性</p>
                    <p className="text-[10px] text-gray-400 mt-1">控制谁可以访问您的公开主页</p>
                  </div>
                  <select 
                    value={formData.privacySettings.profileVisibility}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      privacySettings: { ...formData.privacySettings, profileVisibility: e.target.value as any } 
                    })}
                    className="bg-transparent border-none text-sm font-bold text-amber-800 focus:ring-0"
                  >
                    <option value="all">所有人可见</option>
                    <option value="followers">仅关注我的人可见</option>
                  </select>
                </div>
              </div>

              {errorMessage && (
                <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                  {errorMessage}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
