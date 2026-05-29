import { UserProfile } from '../../../types';

export const ProfileHeader = ({
  userProfile,
  onOpenCuratorTIQuiz,
}: {
  userProfile: UserProfile;
  onOpenCuratorTIQuiz: () => void;
}) => (
  <div className="relative h-[220px]">
    <img src={userProfile.headerUrl} className="w-full h-full object-cover" />
    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
    <div className="absolute bottom-6 left-6 right-6 flex items-end gap-4">
      <img src={userProfile.photoURL} className="w-16 h-16 rounded-2xl border-2 border-white/20 shadow-xl" />
      <div className="flex-1 text-white pb-1">
        <h2 className="text-xl font-bold">{userProfile.displayName}</h2>
        <div className="flex items-center gap-4 mt-2 opacity-80">
          <div className="flex items-center gap-1">
            <span className="text-sm font-bold">{userProfile.stats?.likes || 0}</span>
            <span className="text-[10px]">获赞</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-sm font-bold">{userProfile.stats?.following || 0}</span>
            <span className="text-[10px]">关注</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-sm font-bold">{userProfile.stats?.followers || 0}</span>
            <span className="text-[10px]">粉丝</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenCuratorTIQuiz}
          className="mt-3 max-w-full rounded-[5px] bg-white/15 px-3 py-2 text-left text-[10px] font-bold text-white backdrop-blur-md"
        >
          {userProfile.curatorTI ? `策展 TI ${userProfile.curatorTI.code} · ${userProfile.curatorTI.title}` : '测一测我的策展 TI'}
        </button>
      </div>
    </div>
  </div>
);
