import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, 
  Library, 
  Sparkles, 
  User, 
  Heart, 
  Plus, 
  Zap,
  Play,
  Pause,
  Music,
  Volume2,
  VolumeX,
  Repeat,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  ChevronRight,
  History,
  ArrowLeft,
  ArrowRight,
  Share2,
  Bookmark,
  BookmarkCheck,
  Loader2,
  X,
  Send,
  Bell,
  MessageSquare,
  AtSign,
  UserPlus,
  Settings,
  ArrowDown,
  ArrowUp,
  ThumbsUp,
  MessageCircle,
  Globe,
  LayoutGrid,
  Palette,
  Languages,
  Trash2,
  Mic,
  MicOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { me as fetchMe } from './lib/authClient';
import { Artifact, Exhibition, Favorite, UserProfile, Message, Comment, SlideshowSettings, Museum } from './types';
import { MOCK_ARTIFACTS } from './constants';
import { curatorService } from './modules/curation/services/curationService';
import ReactMarkdown from 'react-markdown';
import { ProfileEditModal } from './components/ProfileEditModal';
import { SlideshowOverlay } from './components/SlideshowOverlay';
import { SafeImage } from './components/SafeImage';
import { ArtifactDetail } from './components/ArtifactDetail';
import { BGMGeneratorModal } from './components/BGMGeneratorModal';
import { cn } from './lib/utils';
import { artifactSearchBlob, rankArtifactsByKeywordQuery } from './lib/artifactSearch';
import {
  artifactEraRaw,
  artifactMuseumRaw,
  artifactNameRaw,
  displayDbString,
} from './lib/dbDisplay';
import { AmbientAudioPlayer, isAmbientBgmUrl } from './lib/ambientAudio';
import { PROVINCIAL_MUSEUMS } from '../backend/provincial-museums';
import { fetchMergedArtifacts, searchRelics } from './modules/artifacts/services/artifactsService';
import { fetchMergedMuseums } from './modules/museums/services/museumsService';
import {
  createExhibition as createExhibitionRequest,
  deleteExhibition as deleteExhibitionRequest,
  fetchFavoriteExhibitionDetails,
  fetchMyExhibitions,
  fetchSquareExhibitions,
  toggleFavoriteExhibition,
  updateExhibition as updateExhibitionRequest,
} from './modules/exhibitions/services/exhibitionsService';
import {
  fetchFavoriteArtifactIds,
  fetchFavoriteExhibitionIds,
  toggleFavoriteArtifact,
} from './modules/profile/services/profileService';
import { ArtifactCard } from './modules/artifacts/components/ArtifactCard';
import { ExhibitionCard } from './modules/exhibitions/components/ExhibitionCard';
import { Banner } from './shared/ui/Banner';
import { Drawer } from './shared/ui/Drawer';
import { SettingsModal } from './modules/profile/components/SettingsModal';
import { MuseumSelectorOverlay } from './modules/museums/components/MuseumSelectorOverlay';
import { BottomNav } from './app/components/BottomNav';
import { TopNav } from './app/components/TopNav';
import { ProfileHeader } from './modules/profile/components/ProfileHeader';
import { ProfileTabBar } from './modules/profile/components/ProfileTabBar';
import { SyncPromptOverlay } from './modules/profile/components/SyncPromptOverlay';
import { SearchOverlay } from './modules/search/components/SearchOverlay';
import { MessagingOverlay } from './modules/profile/components/MessagingOverlay';
import { EditExhibitionModal } from './modules/exhibitions/components/EditExhibitionModal';
import { ManageArtifactsModal } from './modules/exhibitions/components/ManageArtifactsModal';
import { ManualExhibitionModal } from './modules/exhibitions/components/ManualExhibitionModal';
import { ExhibitionDetail } from './modules/exhibitions/components/ExhibitionDetail';
import { AIExhibitionModal } from './modules/curation/components/AIExhibitionModal';
import { AICurationEntry } from './modules/curation/components/AICurationEntry';
import { ExploreTabBar } from './modules/artifacts/components/ExploreTabBar';
import { normalizeArtifacts } from './modules/artifacts/normalizers/artifactNormalizers';
import { normalizeExhibition, normalizeExhibitions } from './modules/exhibitions/normalizers/exhibitionNormalizers';
import { getSlideshowArtifacts, mergeArtifactsById } from './shared/lib/domainUtils';

// --- Components ---

const RECOMMENDED_ARTIFACT_LIMIT = 10;
const EDITOR_RECOMMENDED_EXHIBITION_LIMIT = 10;
const ALL_ARTIFACT_PAGE_SIZE = 24;
const TEST_EDITOR_RECOMMENDED_EXHIBITION_ID = 'editor-recommendation-test-exhibition';
const TEST_EDITOR_RECOMMENDED_EXHIBITION: Exhibition = {
  id: TEST_EDITOR_RECOMMENDED_EXHIBITION_ID,
  userId: 'editorial',
  userName: '博悟编辑部',
  userPhoto: '',
  title: '测试展览',
  intro: '编辑推荐展览占位内容，后续可替换为真实推荐展览。',
  coverUrl: '',
  artifactIds: [],
  isPublic: true,
  likesCount: 0,
  favsCount: 0,
  commentsCount: 0,
  createdAt: '2026-05-18T00:00:00.000Z',
  updatedAt: '2026-05-18T00:00:00.000Z',
};

const isEditorRecommendationPlaceholder = (exhibition: Exhibition | null) => (
  exhibition?.id === TEST_EDITOR_RECOMMENDED_EXHIBITION_ID
);

// --- Main App ---

export default function App() {
  const goLogin = () => {
    window.location.hash = '#/login';
  };
  const [activeTab, setActiveTab] = useState('explore');
  const [user, setUser] = useState<{ id: number; displayName: string; photoURL: string } | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [artifactPool, setArtifactPool] = useState<Artifact[]>(MOCK_ARTIFACTS);
  const [museumPool, setMuseumPool] = useState<Museum[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [selectedExhibition, setSelectedExhibition] = useState<Exhibition | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [relicSearchResults, setRelicSearchResults] = useState<Artifact[]>([]);
  const [relicSearchLoading, setRelicSearchLoading] = useState(false);
  const [relicSearchError, setRelicSearchError] = useState('');
  const [lastRelicSearchKeyword, setLastRelicSearchKeyword] = useState('');
  const relicSearchSeq = useRef(0);
  const [searchOverlayTab, setSearchOverlayTab] = useState<'artifact' | 'exhibition' | 'museum' | 'user'>('artifact');
  const [isSearching, setIsSearching] = useState(false);
  const [isMessaging, setIsMessaging] = useState(false);
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [showSyncPrompt, setShowSyncPrompt] = useState(false);
  
  // Guest Data
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('muselink_favorites');
    return saved ? JSON.parse(saved) : [];
  });
  const [history, setHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem('muselink_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [exhFloor, setExhFloor] = useState(1); // 1: My, 2: Square
  const [pullY, setPullY] = useState(0);
  const startY = useRef(0);
  const isPulling = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // AI & Square State
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiKeywords, setAiKeywords] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<Partial<Exhibition> | null>(null);
  const [myExhibitions, setMyExhibitions] = useState<Exhibition[]>([]);
  const [squareExhibitions, setSquareExhibitions] = useState<Exhibition[]>([]);
  const [exploreTab, setExploreTab] = useState('推荐');
  const [museumSubTab, setMuseumSubTab] = useState('中国国家博物馆');
  const [eraSubTab, setEraSubTab] = useState('全部');
  const [messageTab, setMessageTab] = useState<'reminders' | 'chats'>('reminders');
  const [exhSearchQuery, setExhSearchQuery] = useState('');
  const [isExhMultiSelect, setIsExhMultiSelect] = useState(false);
  const [selectedExhIds, setSelectedExhIds] = useState<string[]>([]);
  const [isNotDevelopedOpen, setIsNotDevelopedOpen] = useState(false);
  const [notDevelopedTitle, setNotDevelopedTitle] = useState('');
  const [isEditExhibitionOpen, setIsEditExhibitionOpen] = useState(false);
  const [isManualExhibitionOpen, setIsManualExhibitionOpen] = useState(false);
  const [isCreatingManualExhibition, setIsCreatingManualExhibition] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isManageArtifactsOpen, setIsManageArtifactsOpen] = useState(false);
  const [editingExhibition, setEditingExhibition] = useState<Exhibition | null>(null);
  const [profileTab, setProfileTab] = useState('我的展陈');
  const [favExhibitionIds, setFavExhibitionIds] = useState<string[]>([]);
  const [favoriteExhibitions, setFavoriteExhibitions] = useState<Exhibition[]>([]);
  const [isMuseumSelectorOpen, setIsMuseumSelectorOpen] = useState(false);

  // Slideshow & BGM States
  const [isSlideshowOpen, setIsSlideshowOpen] = useState(false);
  const [isBGMGeneratorOpen, setIsBGMGeneratorOpen] = useState(false);
  const [slideshowExhibition, setSlideshowExhibition] = useState<Exhibition | null>(null);
  const [bgmExhibition, setBgmExhibition] = useState<Exhibition | null>(null);

  const openImmersiveExhibition = (exhibition: Exhibition | null) => {
    const normalized = normalizeExhibition(exhibition);
    if (!normalized) return;
    setIsSearching(false);
    setIsMessaging(false);
    setIsBGMGeneratorOpen(false);
    setIsMuseumSelectorOpen(false);
    setIsNotDevelopedOpen(false);
    setSelectedArtifact(null);
    setSlideshowExhibition(normalized);
    setIsSlideshowOpen(true);
  };

  const executeRelicSearch = async (rawKeyword = searchQuery) => {
    const keyword = rawKeyword.trim();
    const requestId = relicSearchSeq.current + 1;
    relicSearchSeq.current = requestId;
    setIsSearching(true);
    setSearchOverlayTab('artifact');

    if (!keyword) {
      setRelicSearchResults([]);
      setLastRelicSearchKeyword('');
      setRelicSearchError('请输入搜索内容');
      return;
    }

    setRelicSearchLoading(true);
    setRelicSearchError('');
    try {
      const data = await searchRelics(keyword, 200);
      if (relicSearchSeq.current !== requestId) return;
      const remoteArtifacts = normalizeArtifacts(data.artifacts ?? data.relics ?? []);
      const localArtifacts = remoteArtifacts.length > 0
        ? []
        : rankArtifactsByKeywordQuery(artifactPool, keyword).slice(0, 200);
      const artifacts = remoteArtifacts.length > 0 ? remoteArtifacts : localArtifacts;
      setRelicSearchResults(artifacts);
      setLastRelicSearchKeyword(keyword);
      setArtifactPool((current) => mergeArtifactsById(current, artifacts));
    } catch (error) {
      if (relicSearchSeq.current !== requestId) return;
      const localArtifacts = rankArtifactsByKeywordQuery(artifactPool, keyword).slice(0, 200);
      setRelicSearchResults(localArtifacts);
      setLastRelicSearchKeyword(keyword);
      setRelicSearchError(localArtifacts.length > 0 ? '' : error instanceof Error ? error.message : '搜索失败，请稍后重试');
    } finally {
      if (relicSearchSeq.current === requestId) {
        setRelicSearchLoading(false);
      }
    }
  };

  useEffect(() => {
    const keyword = searchQuery.trim();
    if (!isSearching || searchOverlayTab !== 'artifact') return;
    if (!keyword) return;
    if (keyword === lastRelicSearchKeyword) return;

    const timer = window.setTimeout(() => {
      executeRelicSearch(keyword);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [isSearching, lastRelicSearchKeyword, searchOverlayTab, searchQuery]);

  useEffect(() => {
    const keyword = searchQuery.trim();
    if (!isSearching || searchOverlayTab !== 'artifact') return;
    if (!keyword || lastRelicSearchKeyword !== keyword) return;
    if (relicSearchResults.length > 0 || artifactPool.length === 0) return;

    const localArtifacts = rankArtifactsByKeywordQuery(artifactPool, keyword).slice(0, 200);
    if (localArtifacts.length > 0) {
      setRelicSearchResults(localArtifacts);
      setRelicSearchError('');
    }
  }, [artifactPool, isSearching, lastRelicSearchKeyword, relicSearchResults.length, searchOverlayTab, searchQuery]);

  // Artifact Filtering & Sorting
  const [showFilters, setShowFilters] = useState(false);
  const [filterPeriod, setFilterPeriod] = useState('全部');
  const [filterMuseum, setFilterMuseum] = useState('全部');
  const [filterCulture, setFilterCulture] = useState('全部');
  const [sortBy, setSortBy] = useState<'name' | 'favs' | 'era'>('favs');
  const [allArtifactsQuery, setAllArtifactsQuery] = useState('');
  const [allArtifactsVisibleCount, setAllArtifactsVisibleCount] = useState(ALL_ARTIFACT_PAGE_SIZE);
  const [favSearchQuery, setFavSearchQuery] = useState('');
  const [favSortBy, setFavSortBy] = useState<'name' | 'favs'>('favs');

  const MUSEUMS = useMemo(() => {
    const names = new Set<string>();
    museumPool.forEach(m => names.add(m.name));
    artifactPool.forEach(a => { if (a.museum) names.add(a.museum); });
    PROVINCIAL_MUSEUMS.forEach(m => names.add(m.name));
    return Array.from(names);
  }, [artifactPool, museumPool]);

  const ERAS = useMemo(() => {
    const erasFromData = Array.from(new Set(artifactPool.map(a => String(artifactEraRaw(a) ?? '')).filter(Boolean)));
    // 定义一个理想的顺序，如果没有在顺序里的就排在后面
    const order = ['史前', '夏商', '西周', '春秋战国', '秦汉', '三国两晋', '南北朝', '隋唐', '五代十国', '宋', '辽', '金', '元', '明', '清', '民国', '现代'];
    const sorted = erasFromData.sort((a, b) => {
      const idxA = order.findIndex(o => a.includes(o));
      const idxB = order.findIndex(o => b.includes(o));
      if (idxA === -1 && idxB === -1) return a.localeCompare(b);
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
    return ['全部', ...sorted];
  }, [artifactPool]);

  const eraOptions = useMemo(() => (
    ERAS.map((era) => ({
      label: era,
      count: era === '全部'
        ? artifactPool.length
        : artifactPool.filter((artifact) => String(artifactEraRaw(artifact) ?? '').includes(era)).length,
    }))
  ), [ERAS, artifactPool]);

  const featuredEraOptions = useMemo(() => (
    eraOptions.filter((era) => era.label !== '全部' && era.count > 0).slice(0, 8)
  ), [eraOptions]);

  const museumCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    artifactPool.forEach((artifact) => {
      if (!artifact.museum) return;
      counts[artifact.museum] = (counts[artifact.museum] ?? 0) + 1;
    });
    museumPool.forEach((museum) => {
      counts[museum.name] = Math.max(counts[museum.name] ?? 0, museum.artifactCount ?? 0);
    });
    return counts;
  }, [artifactPool, museumPool]);

  const museumsByProvince = useMemo(() => {
    const map: Record<string, string[]> = {};
    const matched = new Set<string>();

    PROVINCIAL_MUSEUMS.forEach(m => {
      // 保持 location 的完整性，或者对于“中央部门”特殊处理
      const prov = m.location === '中央部门' ? '中央部门' : m.location.replace(/省|市|自治区|特别行政区/g, '');
      if (!map[prov]) map[prov] = [];
      
      // 只要在名录里的，无论是否有文物数据，都显示出来（符合名录要求）
      map[prov].push(m.name);
      if (MUSEUMS.includes(m.name)) {
        matched.add(m.name);
      }
    });

    // 处理那些有文物数据但不在名录里的博物馆
    MUSEUMS.forEach(m => {
      if (!matched.has(m) && !PROVINCIAL_MUSEUMS.some(p => p.name === m)) {
        const prov = '其他';
        if (!map[prov]) map[prov] = [];
        if (!map[prov].includes(m)) map[prov].push(m);
      }
    });

    // 排序省份：中央部门排第一，其他排最后
    const sortedMap: Record<string, string[]> = {};
    const provinces = Object.keys(map).sort((a, b) => {
      if (a === '中央部门') return -1;
      if (b === '中央部门') return 1;
      if (a === '其他') return 1;
      if (b === '其他') return -1;
      return a.localeCompare(b, 'zh-CN');
    });

    provinces.forEach(p => {
      sortedMap[p] = map[p];
    });

    return sortedMap;
  }, [MUSEUMS]);

  const trimmedSearchQuery = searchQuery.trim();
  const searchArtifactResults = lastRelicSearchKeyword === trimmedSearchQuery
    ? relicSearchResults
    : [];

  const searchExhibitionResults = useMemo(() => {
    const combined = [...myExhibitions, ...squareExhibitions];
    const uniq = Array.from(new Map(combined.map((e) => [e.id, e])).values());
    const q = searchQuery.trim().toLowerCase();
    if (!q) return uniq;
    return uniq.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.intro || '').toLowerCase().includes(q),
    );
  }, [myExhibitions, squareExhibitions, searchQuery]);

  const searchMuseumResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const museums = museumPool.length > 0
      ? museumPool
      : MUSEUMS.map((name) => ({
        id: name,
        name,
        description: '',
        location: '',
        imageUrl: '',
        artifactIds: artifactPool.filter((artifact) => artifact.museum === name).map((artifact) => artifact.id),
        artifactCount: artifactPool.filter((artifact) => artifact.museum === name).length,
        periods: [],
        materials: [],
        updatedAt: '',
      }));
    if (!q) return museums;
    return museums.filter((museum) => museum.name.toLowerCase().includes(q));
  }, [MUSEUMS, artifactPool, museumPool, searchQuery]);

  const recommendedArtifacts = useMemo(
    () => artifactPool.slice().sort((a, b) => b.favsCount - a.favsCount),
    [artifactPool]
  );

  const previewRecommendedArtifacts = useMemo(
    () => recommendedArtifacts.slice(0, RECOMMENDED_ARTIFACT_LIMIT),
    [recommendedArtifacts]
  );

  const editorRecommendedExhibitions = useMemo(
    () => [TEST_EDITOR_RECOMMENDED_EXHIBITION].slice(0, EDITOR_RECOMMENDED_EXHIBITION_LIMIT),
    []
  );

  const museumArtifacts = useMemo(() => {
    return artifactPool
      .filter(a => a.museum === museumSubTab)
      .slice()
      .sort((a, b) => (b.favsCount || 0) - (a.favsCount || 0));
  }, [artifactPool, museumSubTab]);

  const activeMuseum = useMemo(() => {
     const fromPool = museumPool.find((museum) => museum.name === museumSubTab);
     if (fromPool) return fromPool;

     const fromSeed = PROVINCIAL_MUSEUMS.find(m => m.name === museumSubTab);
     if (fromSeed) {
       return {
         id: fromSeed.name,
         name: fromSeed.name,
         description: `${fromSeed.name}是位于${fromSeed.location}的国家一级博物馆。`,
         location: fromSeed.location,
         imageUrl: 'https://images.unsplash.com/photo-1566127992631-137a642a90f4?auto=format&fit=crop&q=80&w=1200',
         artifactIds: [],
         artifactCount: 0,
         periods: [],
         materials: [],
         updatedAt: new Date().toISOString()
       } as Museum;
     }
     return null;
   }, [museumPool, museumSubTab]);

  const eraArtifacts = artifactPool
    .filter(a => eraSubTab === '全部' || String(artifactEraRaw(a) ?? '').includes(eraSubTab))
    .slice()
    .sort((a, b) => b.favsCount - a.favsCount);

  const filteredArtifacts = useMemo(() => {
    const q = allArtifactsQuery.trim().toLowerCase();
    return artifactPool
      .filter(a => filterPeriod === '全部' || String(artifactEraRaw(a) ?? '').includes(filterPeriod))
      .filter(a => filterMuseum === '全部' || a.museum === filterMuseum)
      .filter(a => filterCulture === '全部' || a.culture === filterCulture)
      .filter((artifact) => {
        if (!q) return true;
        return artifactSearchBlob(artifact).includes(q);
      })
      .slice()
      .sort((a, b) => {
        if (sortBy === 'name') return displayDbString(artifactNameRaw(a)).localeCompare(displayDbString(artifactNameRaw(b)), 'zh-CN');
        if (sortBy === 'era') return displayDbString(artifactEraRaw(a)).localeCompare(displayDbString(artifactEraRaw(b)), 'zh-CN');
        return (b.favsCount || 0) - (a.favsCount || 0);
      });
  }, [allArtifactsQuery, artifactPool, filterCulture, filterMuseum, filterPeriod, sortBy]);

  const visibleFilteredArtifacts = useMemo(
    () => filteredArtifacts.slice(0, allArtifactsVisibleCount),
    [allArtifactsVisibleCount, filteredArtifacts]
  );

  const refreshFavoriteExhibitions = async () => {
    if (!user) {
      setFavoriteExhibitions([]);
      return;
    }
    const response = await fetchFavoriteExhibitionDetails();
    setFavoriteExhibitions(normalizeExhibitions(response.exhibitions));
  };

  const toggleExhibitionFavorite = async (id: string) => {
    if (!user) {
      goLogin();
      return;
    }
    try {
      const res = await toggleFavoriteExhibition(id);
      setFavExhibitionIds(res.favExhibitions);
      setSquareExhibitions(prev => prev.map(exh => exh.id === id ? { ...exh, favsCount: res.favsCount } : exh));
      setMyExhibitions(prev => prev.map(exh => exh.id === id ? { ...exh, favsCount: res.favsCount } : exh));
      setSelectedExhibition(prev => prev?.id === id ? { ...prev, favsCount: res.favsCount } : prev);
      if (res.isFavorite) {
        const source = squareExhibitions.find(exh => exh.id === id) || myExhibitions.find(exh => exh.id === id) || selectedExhibition;
        if (source?.id === id) {
          setFavoriteExhibitions(prev => [source, ...prev.filter(exh => exh.id !== id)]);
        } else {
          await refreshFavoriteExhibitions();
        }
      } else {
        setFavoriteExhibitions(prev => prev.filter(exh => exh.id !== id));
      }
    } catch (error) {
      console.error("Toggle exhibition favorite error:", error);
    }
  };

  const handleUpdateExhibition = async (updated: Partial<Exhibition>) => {
    if (!user || !editingExhibition) return;
    try {
      const response = await updateExhibitionRequest(editingExhibition.id, updated);
      const saved = normalizeExhibition(response);
      if (!saved) throw new Error('展陈数据格式异常');
      setMyExhibitions(prev => prev.map(e => e.id === editingExhibition.id ? saved : e));
      setSelectedExhibition(prev => prev?.id === saved.id ? saved : prev);
      setIsEditExhibitionOpen(false);
      setEditingExhibition(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteExhibition = async (id: string) => {
    if (!user) return;
    try {
      await deleteExhibitionRequest(id);
      setMyExhibitions(prev => prev.filter(e => e.id !== id));
      setIsEditExhibitionOpen(false);
      setEditingExhibition(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (activeTab !== 'exhibition') return;
    const scroll = scrollRef.current?.scrollTop || 0;
    if (scroll <= 0) {
      startY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling.current || activeTab !== 'exhibition') return;
    
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - startY.current;

    if (exhFloor === 1 && deltaY > 0) {
      // Pulling down from Floor 1
      e.preventDefault();
      // Apply damping: log or power factor
      const dampedY = Math.pow(deltaY, 0.8);
      setPullY(dampedY);
    } else if (exhFloor === 2 && deltaY < 0) {
      // Pulling up from Floor 2
      const scroll = scrollRef.current?.scrollTop || 0;
      if (scroll <= 0) {
        e.preventDefault();
        const dampedY = -Math.pow(Math.abs(deltaY), 0.8);
        setPullY(dampedY);
      }
    }
  };

  const handleTouchEnd = () => {
    if (!isPulling.current) return;
    isPulling.current = false;

    if (exhFloor === 1 && pullY > 80) {
      setExhFloor(2);
    } else if (exhFloor === 2 && pullY < -80) {
      setExhFloor(1);
    }
    
    setPullY(0);
  };

  useEffect(() => {
    (async () => {
      try {
        const me = await fetchMe();
        setUser({
          id: me.id,
          displayName: me.profile?.displayName || `用户${String(me.id).slice(-4)}`,
          photoURL: me.profile?.photoURL || '',
        });
        setUserProfile({
          uid: String(me.id),
          displayName: me.profile?.displayName || `用户${String(me.id).slice(-4)}`,
          photoURL: me.profile?.photoURL || '',
          bio: me.profile?.bio || '',
          headerUrl: me.profile?.headerUrl || '',
          role: me.profile?.role || 'user',
          privacySettings: me.profile?.privacySettings || { profileVisibility: 'all' },
          stats: me.profile?.stats || { favArtifacts: 0, myExhibitions: 0, favExhibitions: 0, likes: 0, following: 0, followers: 0 },
        } as UserProfile);

        const localFavs = JSON.parse(localStorage.getItem('muselink_favorites') || '[]');
        if (localFavs.length > 0) {
          setShowSyncPrompt(true);
        }

        const favs = await fetchFavoriteArtifactIds();
        setFavorites(favs.favorites || []);
        const favExh = await fetchFavoriteExhibitionIds();
        setFavExhibitionIds(favExh.favExhibitions || []);
        const favExhDetails = await fetchFavoriteExhibitionDetails();
        setFavoriteExhibitions(normalizeExhibitions(favExhDetails.exhibitions));
      } catch {
        setUser(null);
        setUserProfile(null);
        setFavoriteExhibitions([]);
        const saved = localStorage.getItem('muselink_favorites');
        setFavorites(saved ? JSON.parse(saved) : []);
      }
    })();
    const handleTabChange = (e: any) => setActiveTab(e.detail);
    const handleOpenArtifact = (e: any) => setSelectedArtifact(e.detail);
    
    window.addEventListener('change-tab', handleTabChange);
    window.addEventListener('open-artifact', handleOpenArtifact);
    return () => {
      window.removeEventListener('change-tab', handleTabChange);
      window.removeEventListener('open-artifact', handleOpenArtifact);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('muselink_favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    const refreshFavoritesFromServerOrLocal = async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      try {
        const favs = await fetchFavoriteArtifactIds();
        setFavorites(favs.favorites || []);
      } catch {
        try {
          const saved = localStorage.getItem("muselink_favorites");
          setFavorites(saved ? JSON.parse(saved) : []);
        } catch {
          setFavorites([]);
        }
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "muselink_favorites" || !e.newValue) return;
      try {
        setFavorites(JSON.parse(e.newValue));
      } catch {
        /* ignore */
      }
    };
    document.addEventListener("visibilitychange", refreshFavoritesFromServerOrLocal);
    window.addEventListener("focus", refreshFavoritesFromServerOrLocal);
    window.addEventListener("storage", onStorage);
    return () => {
      document.removeEventListener("visibilitychange", refreshFavoritesFromServerOrLocal);
      window.removeEventListener("focus", refreshFavoritesFromServerOrLocal);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('muselink_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchArtifacts = async () => {
      try {
        const data = await fetchMergedArtifacts({ signal: controller.signal });
        if (!controller.signal.aborted && Array.isArray(data.artifacts) && data.artifacts.length > 0) {
          setArtifactPool(data.artifacts);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Fetch artifacts error:", error);
        }
      }
    };

    fetchArtifacts();
    
    // 每 30 秒自动刷新一次数据，确保与管理后台同步
    const interval = setInterval(fetchArtifacts, 30000);
    
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const fetchMuseums = async () => {
      try {
        const data = await fetchMergedMuseums({ signal: controller.signal });
        if (!controller.signal.aborted && Array.isArray(data.museums)) {
          setMuseumPool(data.museums);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Fetch museums error:", error);
        }
      }
    };

    fetchMuseums();
    return () => controller.abort();
  }, [artifactPool.length]);

  useEffect(() => {
    if (ERAS.length > 0 && !ERAS.includes(eraSubTab)) {
      setEraSubTab(ERAS[0]);
    }
  }, [ERAS, eraSubTab]);

  useEffect(() => {
    setAllArtifactsVisibleCount(ALL_ARTIFACT_PAGE_SIZE);
  }, [allArtifactsQuery, filterCulture, filterMuseum, filterPeriod, sortBy]);

  const toggleFavorite = async (id: string) => {
    const isFav = favorites.includes(id);
    if (!user) {
      setFavorites(prev => isFav ? prev.filter(i => i !== id) : [...prev, id]);
    } else {
      try {
        const res = await toggleFavoriteArtifact(id);
        setFavorites(res.favorites || []);
      } catch (error) {
        console.error("Toggle favorite error:", error);
      }
    }
  };

  const fetchBackendArtifactPool = async () => {
    const data = await fetchMergedArtifacts({ errorPrefix: 'Failed to fetch backend artifacts' });
    if (!Array.isArray(data.artifacts) || data.artifacts.length === 0) {
      throw new Error('后端文物库为空，无法生成展览。');
    }
    setArtifactPool(data.artifacts);
    return data.artifacts as Artifact[];
  };

  const handleAIGenerate = async (keywords: string, generateBGM: boolean) => {
    setIsGenerating(true);
    try {
      const backendArtifacts = await fetchBackendArtifactPool();
      const result = await curatorService.generateExhibition(keywords, backendArtifacts);
      const coverArtifact = backendArtifacts.find((artifact) => result.artifactIds?.includes(artifact.id));
      const coverUrl = result.coverUrl || coverArtifact?.imageUrl || '';
      const bgmUrl = generateBGM ? 'ambient://rain-ocean-wind' : undefined;
      setAiResult({ ...result, coverUrl, bgmUrl });
    } catch (e) {
      console.error("AI Generation failed:", e);
      alert(e instanceof Error ? e.message : '策展生成失败，请稍后重试。');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAICollect = async () => {
    if (!user) {
      goLogin();
      return;
    }
    if (!aiResult) return;

    try {
      const created = await createExhibitionRequest({
        title: aiResult.title || '未命名展陈',
        intro: aiResult.intro || '',
        coverUrl: aiResult.coverUrl || '',
        artifactIds: aiResult.artifactIds || [],
        isPublic: false,
        bgmUrl: aiResult.bgmUrl,
        slideshowSettings: aiResult.slideshowSettings,
      });
      const normalized = normalizeExhibition(created);
      if (!normalized) throw new Error('展陈数据格式异常');
      setMyExhibitions(prev => [normalized, ...prev]);
      if (normalized.isPublic) {
        setSquareExhibitions(prev => [normalized, ...prev.filter(exh => exh.id !== normalized.id)]);
      }
      setUserProfile(prev => prev ? {
        ...prev,
        stats: { ...prev.stats, myExhibitions: (prev.stats?.myExhibitions || 0) + 1 },
      } : prev);
      setSelectedExhibition(normalized);
      setIsAIModalOpen(false);
      setAiResult(null);
    } catch (e) {
      console.error("Collection failed:", e);
    }
  };

  const handleCreateManualExhibition = async (
    draft: Pick<Exhibition, 'title' | 'intro' | 'coverUrl' | 'artifactIds' | 'isPublic'>
  ) => {
    if (!user) {
      goLogin();
      return;
    }
    if (draft.artifactIds.length === 0) {
      alert('请至少选择一件文物。');
      return;
    }

    setIsCreatingManualExhibition(true);
    try {
      const created = await createExhibitionRequest({
        ...draft,
        slideshowSettings: {
          duration: 4,
          transition: 'fade',
          showIntro: true,
          loop: true,
        },
      });
      const normalized = normalizeExhibition(created);
      if (!normalized) throw new Error('展陈数据格式异常');
      setMyExhibitions(prev => [normalized, ...prev]);
      if (normalized.isPublic) {
        setSquareExhibitions(prev => [normalized, ...prev.filter(exh => exh.id !== normalized.id)]);
      }
      setUserProfile(prev => prev ? {
        ...prev,
        stats: { ...prev.stats, myExhibitions: (prev.stats?.myExhibitions || 0) + 1 },
      } : prev);
      setSelectedExhibition(normalized);
      setIsManualExhibitionOpen(false);
    } catch (e) {
      console.error("Manual exhibition creation failed:", e);
      alert(e instanceof Error ? e.message : '新建策展失败，请稍后重试。');
    } finally {
      setIsCreatingManualExhibition(false);
    }
  };

  useEffect(() => {
    const fetchExhibitions = async () => {
      try {
        const square = await fetchSquareExhibitions(10);
        setSquareExhibitions(normalizeExhibitions(square.exhibitions));

        if (user) {
          const mine = await fetchMyExhibitions();
          setMyExhibitions(normalizeExhibitions(mine.exhibitions));
          const favoriteDetails = await fetchFavoriteExhibitionDetails();
          setFavoriteExhibitions(normalizeExhibitions(favoriteDetails.exhibitions));
        } else {
          setMyExhibitions([]);
          setFavoriteExhibitions([]);
        }
      } catch (e) {
        console.error("Fetch exhibitions error:", e);
      }
    };
    fetchExhibitions();
  }, [user]);

  const syncGuestData = async () => {
    if (!user) return;
    const localFavs = JSON.parse(localStorage.getItem('muselink_favorites') || '[]');
    const localHistory = JSON.parse(localStorage.getItem('muselink_history') || '[]');

    try {
      const cloud = await fetchFavoriteArtifactIds();
      const cloudSet = new Set(cloud.favorites || []);
      for (const id of localFavs) {
        if (!cloudSet.has(id)) {
          await toggleFavoriteArtifact(id);
        }
      }

      // Clear local
      localStorage.removeItem('muselink_favorites');
      localStorage.removeItem('muselink_history');
      
      // Refresh favorites state
      const refreshed = await fetchFavoriteArtifactIds();
      setFavorites(refreshed.favorites || []);
      setShowSyncPrompt(false);
    } catch (error) {
      console.error("Sync data error:", error);
    }
  };

  const addToHistory = (id: string) => {
    setHistory(prev => [id, ...prev.filter(i => i !== id)].slice(0, 50));
  };

  const favoriteArtifacts = useMemo(() => {
    const favoriteIds = new Set(favorites);
    return artifactPool.filter((artifact) => favoriteIds.has(artifact.id));
  }, [artifactPool, favorites]);

  const activeSlideshowExhibition = slideshowExhibition || selectedExhibition;

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden bg-gray-50 pb-20 font-sans selection:bg-amber-100 no-scrollbar">
      <Drawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        user={user} 
        onLoginClick={goLogin}
        onEditProfile={() => setIsProfileEditOpen(true)}
        onSettingsClick={() => setIsSettingsOpen(true)}
        onFeatureClick={(title) => {
          setNotDevelopedTitle(title);
          setIsNotDevelopedOpen(true);
        }}
      />
      
      <TopNav 
        onMenuClick={() => setIsDrawerOpen(true)}
        onSearchClick={() => setIsSearching(true)}
        onBellClick={() => {
          if (!user) goLogin();
          else setIsMessaging(true);
        }}
        onSubmitSearch={() => executeRelicSearch()}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      <main className="max-w-2xl mx-auto min-h-[calc(100vh-120px)]">
        <AnimatePresence mode="wait">
          {activeTab === 'explore' && (
            <motion.div
              key="explore"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col min-h-screen"
            >
              {/* 1. Top Tab Bar (Sticky) */}
              <ExploreTabBar exploreTab={exploreTab} setExploreTab={setExploreTab} />

              <div className="p-4 space-y-6 flex-1">
                <AnimatePresence mode="wait">
                  {exploreTab === '推荐' && (
                    <motion.div
                      key="recommend"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                      {/* 2. Banner */}
                      <Banner artifacts={recommendedArtifacts} />

                      {/* 3. Editor Recommendations */}
                      <div className="space-y-4">
                        <h2 className="text-lg font-bold text-secondary font-serif flex items-center gap-2 force-nowrap">
                          <BookmarkCheck size={18} className="text-primary flex-shrink-0" />
                          编辑推荐
                        </h2>

                        <div className="columns-2 gap-1.5">
                          {editorRecommendedExhibitions.map(exhibition => (
                            <div key={exhibition.id} className="break-inside-avoid mb-1.5">
                              <ExhibitionCard
                                exhibition={exhibition}
                                onClick={() => setSelectedExhibition(exhibition)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 4. Discovery Section */}
                      <div className="space-y-4">
                        <h2 className="text-lg font-bold text-secondary font-serif flex items-center gap-2 force-nowrap">
                          <Sparkles size={18} className="text-primary flex-shrink-0" />
                          推荐文物
                        </h2>
                        
                        <div className="columns-2 gap-1.5">
                          {previewRecommendedArtifacts.map(artifact => (
                            <div key={artifact.id} className="break-inside-avoid mb-1.5">
                              <ArtifactCard 
                                artifact={artifact} 
                                onClick={() => {
                                  setSelectedArtifact(artifact);
                                  addToHistory(artifact.id);
                                }} 
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {exploreTab === '馆藏全览' && (
                    <motion.div
                      key="all-artifacts"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-4"
                    >
                      <div className="sticky top-[110px] z-30 -mx-4 space-y-3 border-b border-gray-100 bg-neutral/95 px-4 py-3 backdrop-blur-md">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">馆藏全览</p>
                            <h2 className="break-words text-base font-bold text-secondary">
                              {filteredArtifacts.length} / {artifactPool.length} 件文物
                            </h2>
                          </div>
                          {(allArtifactsQuery || filterMuseum !== '全部' || filterPeriod !== '全部' || sortBy !== 'favs') && (
                            <button
                              onClick={() => {
                                setAllArtifactsQuery('');
                                setFilterMuseum('全部');
                                setFilterPeriod('全部');
                                setSortBy('favs');
                              }}
                              className="flex-shrink-0 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-gray-500 shadow-sm"
                            >
                              重置
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2.5 shadow-sm">
                          <Search size={16} className="flex-shrink-0 text-gray-400" />
                          <input
                            value={allArtifactsQuery}
                            onChange={(event) => setAllArtifactsQuery(event.target.value)}
                            placeholder="搜索名称、博物馆、年代、文化"
                            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-gray-700 outline-none placeholder:text-gray-300"
                          />
                          {allArtifactsQuery && (
                            <button
                              onClick={() => setAllArtifactsQuery('')}
                              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400"
                              aria-label="清除馆藏搜索"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <select
                            value={filterMuseum}
                            onChange={(event) => setFilterMuseum(event.target.value)}
                            className="min-w-0 rounded-xl border border-gray-100 bg-white px-2 py-2 text-xs font-bold text-gray-600 shadow-sm outline-none"
                          >
                            <option value="全部">全部博物馆</option>
                            {MUSEUMS.slice().sort((a, b) => (museumCounts[b] ?? 0) - (museumCounts[a] ?? 0) || a.localeCompare(b, 'zh-CN')).map((museum) => (
                              <option key={museum} value={museum}>{museum}</option>
                            ))}
                          </select>
                          <select
                            value={filterPeriod}
                            onChange={(event) => setFilterPeriod(event.target.value)}
                            className="min-w-0 rounded-xl border border-gray-100 bg-white px-2 py-2 text-xs font-bold text-gray-600 shadow-sm outline-none"
                          >
                            {eraOptions.map((era) => (
                              <option key={era.label} value={era.label}>{era.label}</option>
                            ))}
                          </select>
                          <select
                            value={sortBy}
                            onChange={(event) => setSortBy(event.target.value as 'name' | 'favs' | 'era')}
                            className="min-w-0 rounded-xl border border-gray-100 bg-white px-2 py-2 text-xs font-bold text-gray-600 shadow-sm outline-none"
                          >
                            <option value="favs">热门优先</option>
                            <option value="name">名称排序</option>
                            <option value="era">年代排序</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="columns-2 gap-1.5">
                        {visibleFilteredArtifacts.map(artifact => (
                          <div key={`all-${artifact.id}`} className="break-inside-avoid mb-1.5">
                            <ArtifactCard 
                              artifact={artifact} 
                              onClick={() => {
                                setSelectedArtifact(artifact);
                                addToHistory(artifact.id);
                              }} 
                            />
                          </div>
                        ))}
                      </div>
                      {filteredArtifacts.length > visibleFilteredArtifacts.length && (
                        <button
                          onClick={() => setAllArtifactsVisibleCount((count) => count + ALL_ARTIFACT_PAGE_SIZE)}
                          className="w-full rounded-2xl border border-gray-100 bg-white py-3 text-sm font-bold text-primary shadow-sm active:scale-[0.99] transition-all"
                        >
                          加载更多（剩余 {filteredArtifacts.length - visibleFilteredArtifacts.length} 件）
                        </button>
                      )}
                      {filteredArtifacts.length === 0 && (
                        <div className="py-20 text-center text-gray-300 text-sm italic">
                          暂无匹配馆藏
                        </div>
                      )}
                    </motion.div>
                  )}

                  {exploreTab === '博物馆' && (
                    <motion.div
                      key="museum"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-4"
                    >
                      <div className="sticky top-[110px] z-30 bg-neutral/95 backdrop-blur-md py-2 -mx-4 px-4 border-b border-gray-100">
                        <button 
                          onClick={() => setIsMuseumSelectorOpen(true)}
                          className="w-full flex items-center justify-between gap-3 px-4 py-2 bg-white rounded-xl border border-gray-100 shadow-sm active:scale-[0.98] transition-all min-h-14"
                        >
                          <div className="min-w-0 flex flex-col text-left">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-tight">当前选中博物馆</span>
                            <span className="break-words text-xs font-bold leading-tight text-gray-900">{museumSubTab}</span>
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-2">
                            <span className="rounded-full bg-neutral px-2 py-1 text-[10px] font-bold text-primary">
                              {museumArtifacts.length} 件
                            </span>
                            <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">切换</span>
                          </div>
                        </button>
                      </div>

                      {activeMuseum && (
                        <div className="bg-white border border-gray-100 rounded-[5px] overflow-hidden shadow-sm">
                          <SafeImage 
                            src={activeMuseum.imageUrl} 
                            alt={activeMuseum.name} 
                            className="h-28 w-full object-cover" 
                          />
                          <div className="p-4 space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <h2 className="min-w-0 break-words text-lg font-bold font-serif text-secondary">{activeMuseum.name}</h2>
                              <span className="text-[10px] font-bold text-primary bg-neutral px-2 py-1 rounded-full whitespace-nowrap">
                                {museumArtifacts.length} 件文物
                              </span>
                            </div>
                            <p className="break-words text-xs leading-relaxed text-gray-500">
                              {activeMuseum.description}
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="columns-2 gap-1.5">
                        {museumArtifacts.map(artifact => (
                          <div key={artifact.id} className="break-inside-avoid mb-1.5">
                            <ArtifactCard 
                              artifact={artifact} 
                              onClick={() => {
                                setSelectedArtifact(artifact);
                                addToHistory(artifact.id);
                              }} 
                            />
                          </div>
                        ))}
                        {museumArtifacts.length === 0 && (
                          <div className="col-span-2 py-20 text-center text-gray-300 text-sm italic force-nowrap">
                            暂无该馆藏品数据
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {exploreTab === '年代' && (
                    <motion.div
                      key="era"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-4"
                    >
                      <div className="sticky top-[110px] z-30 bg-neutral/95 backdrop-blur-md py-3 -mx-4 px-4 border-b border-gray-100 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">按年代浏览</p>
                            <h2 className="break-words text-base font-bold text-secondary">
                              {eraSubTab === '全部' ? '全部年代' : eraSubTab}
                            </h2>
                          </div>
                          <span className="flex-shrink-0 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-primary shadow-sm">
                            {eraArtifacts.length} 件
                          </span>
                        </div>
                        <select
                          value={eraSubTab}
                          onChange={(event) => setEraSubTab(event.target.value)}
                          className="w-full rounded-xl border border-gray-100 bg-white px-3 py-2.5 text-sm font-bold text-gray-700 shadow-sm outline-none"
                        >
                          {eraOptions.map(e => (
                            <option key={e.label} value={e.label}>
                              {e.label}（{e.count}）
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                          {featuredEraOptions.map(e => (
                            <button
                              key={e.label}
                              onClick={() => setEraSubTab(e.label)}
                              className={cn(
                                "px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all force-nowrap",
                                eraSubTab === e.label ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-white text-gray-500 border border-gray-100"
                              )}
                            >
                              {e.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="columns-2 gap-1.5">
                        {eraArtifacts.map(artifact => (
                          <div key={artifact.id} className="break-inside-avoid mb-1.5">
                            <ArtifactCard 
                              artifact={artifact} 
                              onClick={() => {
                                setSelectedArtifact(artifact);
                                addToHistory(artifact.id);
                              }} 
                            />
                          </div>
                        ))}
                        {eraArtifacts.length === 0 && (
                          <div className="col-span-2 py-20 text-center text-gray-300 text-sm italic force-nowrap">
                            暂无该年代藏品数据
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {activeTab === 'exhibition' && (
            <motion.div
              key="exhibition"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4 space-y-10"
            >
              {/* 1. AI Curation */}
              <AICurationEntry onOpen={() => setIsAIModalOpen(true)} />

              {/* 2. My Curation (Horizontal Scroll) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Library size={18} className="text-primary flex-shrink-0" />
                    <h2 className="text-lg font-bold text-secondary font-serif force-nowrap">我的策展</h2>
                  </div>
                  {user && <span className="text-[10px] font-bold text-primary bg-neutral px-2 py-0.5 rounded-full border border-gray-100 force-nowrap">{myExhibitions.length}</span>}
                </div>
                
                <div className="flex gap-4 overflow-x-auto no-scrollbar -mx-4 px-4 pb-2 snap-x">
                  {user ? (
                    myExhibitions.length > 0 ? (
                      myExhibitions.map(exh => (
                        <div 
                          key={exh.id} 
                          onClick={() => setSelectedExhibition(exh)}
                          className="w-40 flex-shrink-0 space-y-2 cursor-pointer group snap-start"
                        >
                          <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-gray-100 shadow-sm">
                            <img src={exh.coverUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
                          </div>
                          <p className="text-xs font-bold text-gray-800 force-nowrap">{exh.title}</p>
                        </div>
                      ))
                    ) : (
                      <div className="w-full py-10 flex flex-col items-center justify-center text-center space-y-2 opacity-40 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                        <Library size={24} />
                        <p className="text-xs force-nowrap">暂无策展内容</p>
                      </div>
                    )
                  ) : (
                    <div className="w-full py-10 flex flex-col items-center justify-center text-center space-y-3 bg-gray-50 rounded-3xl border border-gray-100">
                      <p className="text-xs text-gray-400 force-nowrap">登录后查看我的策展</p>
                      <button onClick={goLogin} className="px-6 py-2 bg-primary text-white rounded-full text-[10px] font-bold shadow-md shadow-primary/20 force-nowrap">立即登录</button>
                    </div>
                  )}
                  {/* Add New Button as a card */}
                  {user && (
                    <div 
                      onClick={() => {
                        setIsManualExhibitionOpen(true);
                      }}
                      className="w-40 flex-shrink-0 aspect-[4/3] rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-300 hover:text-primary hover:border-primary/30 transition-all cursor-pointer snap-start"
                    >
                      <Plus size={24} />
                      <span className="text-[10px] font-bold mt-2 force-nowrap">新建策展</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Exhibition Square (Vertical) */}
              <div id="exhibition-square" className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe size={18} className="text-amber-800" />
                    <h2 className="text-lg font-bold text-gray-900 whitespace-nowrap force-nowrap">展陈广场</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="text-[10px] font-bold text-amber-800 bg-amber-50 px-3 py-1 rounded-full whitespace-nowrap force-nowrap">最热</button>
                    <button className="text-[10px] font-bold text-gray-400 px-3 py-1 rounded-full whitespace-nowrap force-nowrap">最新</button>
                  </div>
                </div>

                <div className="columns-2 gap-1.5">
                  {squareExhibitions.map(exh => (
                    <div key={exh.id} className="break-inside-avoid mb-1.5">
                      <ExhibitionCard 
                        exhibition={exh} 
                        onClick={() => setSelectedExhibition(exh)} 
                        showFavoriteButton={Boolean(user)}
                        isFavorite={favExhibitionIds.includes(exh.id)}
                        onFavoriteClick={() => toggleExhibitionFavorite(exh.id)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-0"
            >
              {userProfile ? (
                <>
                  {/* Header Area */}
                  <ProfileHeader userProfile={userProfile} />

                  {/* Profile Tabs */}
                  <ProfileTabBar
                    profileTab={profileTab}
                    setProfileTab={setProfileTab}
                    favoriteArtifactsCount={favoriteArtifacts.length}
                    myExhibitionsCount={myExhibitions.length}
                    favExhibitionIdsCount={favExhibitionIds.length}
                  />

                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      {profileTab === '收藏文物' && (
                        <div className="space-y-8">
                          <div className="space-y-6">
                            <div className="flex items-center justify-between px-2">
                              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest force-nowrap">我的收藏</h4>
                              <span className="text-[10px] font-bold text-gray-300 force-nowrap">{favoriteArtifacts.length} 件</span>
                            </div>
                            <div className="columns-2 gap-1.5">
                              {favoriteArtifacts
                                .map(artifact => (
                                  <div key={`fav-wrapper-${artifact.id}`} className="break-inside-avoid mb-1.5">
                                    <ArtifactCard artifact={artifact} onClick={() => setSelectedArtifact(artifact)} />
                                  </div>
                                ))
                              }
                            </div>
                            {favoriteArtifacts.length === 0 && (
                              <div className="py-12 text-center text-gray-300 text-[10px] italic force-nowrap">
                                暂无收藏，快去探索吧
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {profileTab === '我的展陈' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between px-2">
                            <div className="flex items-center gap-2">
                              <Library size={18} className="text-amber-800" />
                              <h4 className="text-sm font-bold text-gray-900">自建展陈</h4>
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => setIsExhMultiSelect(!isExhMultiSelect)}
                                className={cn("p-2 rounded-xl transition-all", isExhMultiSelect ? "bg-amber-800 text-white" : "bg-gray-100 text-gray-500")}
                              >
                                <LayoutGrid size={16} />
                              </button>
                              <button 
                                onClick={() => setIsAIModalOpen(true)}
                                className="p-2 bg-amber-50 text-amber-800 rounded-xl"
                              >
                                <Plus size={16} />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-4">
                            {myExhibitions.map(exh => (
                              <div key={`my-exh-wrapper-${exh.id}`} className="relative">
                                <ExhibitionCard 
                                  exhibition={exh} 
                                  onClick={() => isExhMultiSelect ? (
                                    setSelectedExhIds(prev => prev.includes(exh.id) ? prev.filter(id => id !== exh.id) : [...prev, exh.id])
                                  ) : setSelectedExhibition(exh)} 
                                />
                                {isExhMultiSelect && (
                                  <div 
                                    onClick={() => setSelectedExhIds(prev => prev.includes(exh.id) ? prev.filter(id => id !== exh.id) : [...prev, exh.id])}
                                    className={cn(
                                      "absolute top-4 right-4 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all z-10",
                                      selectedExhIds.includes(exh.id) ? "bg-amber-800 border-amber-800 text-white" : "bg-white/80 border-white text-transparent"
                                    )}
                                  >
                                    <Plus size={14} className={cn(selectedExhIds.includes(exh.id) && "rotate-45")} />
                                  </div>
                                )}
                              </div>
                            ))}
                            {myExhibitions.length === 0 && (
                              <div key="no-my-exhibitions" className="py-20 text-center text-gray-300 text-xs italic">
                                暂无自建展陈
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {profileTab === '收藏展陈' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between px-2">
                            <div className="flex items-center gap-2">
                              <Bookmark size={18} className="text-amber-800" />
                              <h4 className="text-sm font-bold text-gray-900">收藏展陈</h4>
                            </div>
                            <button 
                              onClick={() => setIsExhMultiSelect(!isExhMultiSelect)}
                              className={cn("p-2 rounded-xl transition-all", isExhMultiSelect ? "bg-amber-800 text-white" : "bg-gray-100 text-gray-500")}
                            >
                              <LayoutGrid size={16} />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 gap-4">
                            {favoriteExhibitions.map(exh => {
                              const id = exh.id;
                              return (
                                <div key={`fav-exh-wrapper-${id}`} className="relative">
                                  <ExhibitionCard 
                                    exhibition={exh} 
                                    onClick={() => isExhMultiSelect ? (
                                      setSelectedExhIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
                                    ) : setSelectedExhibition(exh)} 
                                  />
                                  {isExhMultiSelect && (
                                    <div 
                                      onClick={() => setSelectedExhIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])}
                                      className={cn(
                                        "absolute top-4 right-4 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all z-10",
                                        selectedExhIds.includes(id) ? "bg-amber-800 border-amber-800 text-white" : "bg-white/80 border-white text-transparent"
                                      )}
                                    >
                                      <Plus size={14} className={cn(selectedExhIds.includes(id) && "rotate-45")} />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {favoriteExhibitions.length === 0 && (
                              <div key="no-fav-exhibitions" className="py-20 text-center text-gray-300 text-xs italic">
                                暂无收藏展陈
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {isExhMultiSelect && selectedExhIds.length > 0 && (
                      <div className="fixed bottom-24 left-6 right-6 bg-white border border-gray-100 shadow-2xl rounded-2xl p-4 flex items-center justify-between z-[120]">
                        <span className="text-xs font-bold text-gray-600">已选择 {selectedExhIds.length} 项</span>
                        <div className="flex gap-2">
                          <button className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-[10px] font-bold">加入收藏夹</button>
                          <button className="px-4 py-2 bg-rose-50 text-rose-500 rounded-xl text-[10px] font-bold">批量删除</button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="min-h-[calc(100vh-120px)] flex flex-col items-center justify-center p-12 text-center space-y-6">
                  <div className="w-24 h-24 bg-amber-50 rounded-[5px] flex items-center justify-center text-amber-700 shadow-inner">
                    <User size={48} strokeWidth={1.5} />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-bold text-gray-900">登录后查看个人主页</h2>
                    <p className="text-sm text-gray-400 leading-relaxed">
                      登录后即可收藏文物、创建专属展陈、和文博同好互动交流。
                    </p>
                  </div>
                  <button 
                    onClick={goLogin}
                    className="w-full max-w-xs py-3.5 bg-amber-800 text-white rounded-2xl font-bold shadow-xl shadow-amber-800/20 hover:bg-amber-900 transition-all"
                  >
                    立即登录 / 注册
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Overlays */}
      <AIExhibitionModal 
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onGenerate={(keywords, generateBGM) => handleAIGenerate(keywords, generateBGM)}
        isGenerating={isGenerating}
        result={aiResult}
        onCollect={handleAICollect}
        artifacts={artifactPool}
      />

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <ManualExhibitionModal
        isOpen={isManualExhibitionOpen}
        onClose={() => setIsManualExhibitionOpen(false)}
        onCreate={handleCreateManualExhibition}
        artifacts={artifactPool}
        isCreating={isCreatingManualExhibition}
      />

      <EditExhibitionModal 
        isOpen={isEditExhibitionOpen} 
        onClose={() => {
          setIsEditExhibitionOpen(false);
          setEditingExhibition(null);
        }} 
        exhibition={editingExhibition}
        onUpdate={handleUpdateExhibition}
        onDelete={handleDeleteExhibition}
        onManageArtifacts={() => setIsManageArtifactsOpen(true)}
        onSlideshowPreview={() => {
          if (editingExhibition) {
            openImmersiveExhibition(editingExhibition);
          }
        }}
        onBGMGenerate={() => {
          if (editingExhibition) {
            setBgmExhibition(editingExhibition);
            setIsBGMGeneratorOpen(true);
          }
        }}
      />

      <ManageArtifactsModal 
        isOpen={isManageArtifactsOpen}
        onClose={() => setIsManageArtifactsOpen(false)}
        exhibition={editingExhibition}
        onUpdateArtifacts={(ids) => handleUpdateExhibition({ artifactIds: ids })}
        artifacts={artifactPool}
      />
      <AnimatePresence>
        {isSearching && (
          <SearchOverlay
            setIsSearching={setIsSearching}
            executeRelicSearch={() => executeRelicSearch()}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            relicSearchLoading={relicSearchLoading}
            searchOverlayTab={searchOverlayTab}
            setSearchOverlayTab={setSearchOverlayTab}
            relicSearchError={relicSearchError}
            lastRelicSearchKeyword={lastRelicSearchKeyword}
            searchArtifactResults={searchArtifactResults}
            setSelectedArtifact={setSelectedArtifact}
            addToHistory={addToHistory}
            searchExhibitionResults={searchExhibitionResults}
            setSelectedExhibition={setSelectedExhibition}
            searchMuseumResults={searchMuseumResults}
            setExploreTab={setExploreTab}
            setMuseumSubTab={setMuseumSubTab}
          />
        )}

        {isMessaging && (
          <MessagingOverlay
            setIsMessaging={setIsMessaging}
            messageTab={messageTab}
            setMessageTab={setMessageTab}
          />
        )}

        {selectedExhibition && (
          <ExhibitionDetail 
            key={`exhibition-detail-${selectedExhibition.id}`}
            exhibition={selectedExhibition} 
            onClose={() => setSelectedExhibition(null)} 
            onArtifactClick={(a: Artifact) => setSelectedArtifact(a)}
            artifacts={artifactPool}
            isFavorite={!isEditorRecommendationPlaceholder(selectedExhibition) && favExhibitionIds.includes(selectedExhibition.id)}
            toggleFavorite={() => {
              if (!isEditorRecommendationPlaceholder(selectedExhibition)) {
                toggleExhibitionFavorite(selectedExhibition.id);
              }
            }}
            user={user}
            onEdit={() => {
              setEditingExhibition(selectedExhibition);
              setIsEditExhibitionOpen(true);
            }}
            onSlideshowOpen={openImmersiveExhibition}
            onBGMGeneratorOpen={() => {
              setBgmExhibition(selectedExhibition);
              setIsBGMGeneratorOpen(true);
            }}
          />
        )}

        {isBGMGeneratorOpen && bgmExhibition && (
          <BGMGeneratorModal 
            isOpen={isBGMGeneratorOpen}
            onClose={() => setIsBGMGeneratorOpen(false)}
            exhibition={bgmExhibition}
            onBind={(url) => {
              handleUpdateExhibition({ bgmUrl: url });
              setIsBGMGeneratorOpen(false);
            }}
          />
        )}

        {selectedArtifact && (
          <ArtifactDetail 
            key={`artifact-detail-${selectedArtifact.id}`}
            artifact={selectedArtifact} 
            onClose={() => setSelectedArtifact(null)} 
            allArtifacts={artifactPool}
            isFavorite={favorites.includes(selectedArtifact.id)}
            toggleFavorite={toggleFavorite}
            onArtifactClick={(a: Artifact) => setSelectedArtifact(a)}
          />
        )}
      </AnimatePresence>

      {isSlideshowOpen && activeSlideshowExhibition && (
        <SlideshowOverlay 
          key={`immersive-${activeSlideshowExhibition.id}`}
          isOpen={isSlideshowOpen}
          onClose={() => {
            setIsSlideshowOpen(false);
            setSlideshowExhibition(null);
          }}
          exhibition={activeSlideshowExhibition}
          artifacts={getSlideshowArtifacts(activeSlideshowExhibition, artifactPool)}
          settings={activeSlideshowExhibition.slideshowSettings}
          bgmUrl={activeSlideshowExhibition.bgmUrl}
        />
      )}

      {userProfile && (
        <ProfileEditModal 
          isOpen={isProfileEditOpen}
          onClose={() => setIsProfileEditOpen(false)}
          profile={userProfile}
          onUpdate={(updated) => {
            setUserProfile((prev) => prev ? { ...prev, ...updated } : prev);
            setUser((prev) => prev ? {
              ...prev,
              displayName: updated.displayName || prev.displayName,
              photoURL: updated.photoURL || prev.photoURL,
            } : prev);
          }}
        />
      )}

      <SyncPromptOverlay
        showSyncPrompt={showSyncPrompt}
        syncGuestData={syncGuestData}
        setShowSyncPrompt={setShowSyncPrompt}
      />

      <AnimatePresence>
        {isMuseumSelectorOpen && (
          <MuseumSelectorOverlay 
            isOpen={isMuseumSelectorOpen}
            onClose={() => setIsMuseumSelectorOpen(false)}
            museumsByProvince={museumsByProvince}
            currentMuseum={museumSubTab}
            museumCounts={museumCounts}
            onSelect={(m) => setMuseumSubTab(m)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
