export interface Artifact {
  id: string;
  name: string;
  museum: string;
  /** 年代/朝代/时代：与 `dynasty`、`era`、中文键「朝代」「时代」「年代」等同义，展示时由 `artifactEraRaw` 归并。 */
  period: string;
  material: string;
  culture: string;
  origin: string;
  description: string;
  imageUrl: string;
  tags: string[];
  favsCount: number;
  /** Optional extended fields (populated when present in source data / imports). */
  category?: string;
  level?: string;
  dimensions?: string;
  remarks?: string;
}

export interface Museum {
  id: string;
  name: string;
  description: string;
  location: string;
  imageUrl: string;
  artifactIds: string[];
  artifactCount: number;
  periods: string[];
  materials: string[];
  updatedAt: string;
}

export interface SlideshowSettings {
  duration: number; // 2-10s
  transition: 'fade' | 'slide';
  showIntro: boolean;
  loop: boolean;
}

export interface Exhibition {
  id: string;
  userId: number | string;
  userName: string;
  userPhoto: string;
  title: string;
  intro: string;
  coverUrl: string;
  artifactIds: string[];
  isPublic: boolean;
  likesCount: number;
  favsCount: number;
  commentsCount: number;
  bgmUrl?: string;
  slideshowSettings?: SlideshowSettings;
  createdAt: string;
  updatedAt: string;
}

export interface BGM {
  id: string;
  userId: number | string;
  title: string;
  url: string;
  style: string;
  createdAt: string;
}

export interface Favorite {
  id: string;
  userId: number | string;
  artifactId: string;
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  email?: string;
  phoneNumber?: string;
  bio: string;
  headerUrl: string;
  gender?: 'male' | 'female' | 'other' | 'secret';
  birthday?: string;
  location?: string;
  role: 'user' | 'admin';
  privacySettings: {
    profileVisibility: 'all' | 'followers';
  };
  stats: {
    favArtifacts: number;
    myExhibitions: number;
    favExhibitions: number;
    likes: number;
    following: number;
    followers: number;
  };
}

export interface Follow {
  id: string;
  followerId: number | string;
  followingId: number | string;
  createdAt: string;
}

export interface Message {
  id: string;
  toUserId: number | string;
  fromUserId: number | string;
  fromUserName: string;
  fromUserPhoto: string;
  type: 'like' | 'fav' | 'comment' | 'follow' | 'system';
  content: string;
  targetId?: string; // Exhibition ID or Artifact ID
  isRead: boolean;
  createdAt: string;
}

export interface Comment {
  id: string;
  exhibitionId: string;
  userId: number | string;
  userName: string;
  userPhoto: string;
  content: string;
  createdAt: string;
}

declare global {
  interface Window {
  }
}
