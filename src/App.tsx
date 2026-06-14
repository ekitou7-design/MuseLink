import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  ArrowRight,
  Search, 
  Library, 
  Sparkles, 
  User, 
  Plus, 
  Bookmark,
  BookmarkCheck,
  X,
  Globe,
  LayoutGrid,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { me as fetchMe } from './lib/authClient';
import { Artifact, CuratorTI, Exhibition, UserProfile, Museum } from './types';
import { MOCK_ARTIFACTS } from './constants';
import { curatorService } from './modules/curation/services/curationService';
import { ProfileEditModal } from './components/ProfileEditModal';
import { SlideshowOverlay } from './components/SlideshowOverlay';
import { SafeImage } from './components/SafeImage';
import { ArtifactDetail } from './components/ArtifactDetail';
import { BGMGeneratorModal } from './components/BGMGeneratorModal';
import { cn } from './lib/utils';
import { artifactSearchBlob, rankArtifactsByKeywordQuery } from './lib/artifactSearch';
import {
  artifactEraRaw,
  artifactImageUrlRaw,
  artifactCategoryRaw,
  artifactMaterialRaw,
  artifactMuseumRaw,
  artifactNameRaw,
  displayDbString,
} from './lib/dbDisplay';
import { PROVINCIAL_MUSEUMS } from '../backend/provincial-museums';
import { fetchMergedArtifacts, searchRelics } from './modules/artifacts/services/artifactsService';
import {
  buildArtifactRecommendations,
  readRecommendationPreferences,
  readSearchHistory,
  rememberRecentText,
  writeRecommendationPreferences,
  writeSearchHistory,
} from './modules/artifacts/services/recommendationService';
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
  updateMyProfile,
} from './modules/profile/services/profileService';
import { ArtifactCard } from './modules/artifacts/components/ArtifactCard';
import { ExhibitionCard } from './modules/exhibitions/components/ExhibitionCard';
import { Banner } from './shared/ui/Banner';
import { Drawer } from './shared/ui/Drawer';
import { SettingsModal } from './modules/profile/components/SettingsModal';
import { ProfileFeaturePanel } from './modules/profile/components/ProfileFeaturePanel';
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
import { CuratorTIQuiz } from './modules/curation/components/CuratorTIQuiz';
import { ArtifactSwipePage } from './pages/ArtifactSwipePage';
import type { CuratorGuideAnswers } from './modules/curation/data/curatorPreferences';
import { ExhibitionTopTabs, type ExhibitionView } from './modules/exhibitions/components/ExhibitionTopTabs';
import { ExploreTabBar } from './modules/artifacts/components/ExploreTabBar';
import { normalizeArtifacts } from './modules/artifacts/normalizers/artifactNormalizers';
import { normalizeExhibition, normalizeExhibitions } from './modules/exhibitions/normalizers/exhibitionNormalizers';
import { getSlideshowArtifacts, mergeArtifactsById } from './shared/lib/domainUtils';
import type { SidebarFeatureId } from './modules/profile/data/sidebarContent';
import {
  PREFERENCE_PROFILE_UPDATED_EVENT,
  readPreferenceProfile,
  readSwipeHistory,
  type UserPreferenceProfile,
} from './modules/swipe/utils/preferenceProfile';

// --- Components ---

const RECOMMENDED_ARTIFACT_LIMIT = 8;
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

type ToastState = {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
} | null;

// --- Main App ---

export default function App({ initialTab = 'explore' }: { initialTab?: string }) {
  const goLogin = () => {
    window.location.hash = '#/login';
  };
  const [activeTab, setActiveTab] = useState(initialTab);
  const [user, setUser] = useState<{ id: number; displayName: string; photoURL: string } | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [artifactPool, setArtifactPool] = useState<Artifact[]>(MOCK_ARTIFACTS);
  const [museumPool, setMuseumPool] = useState<Museum[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [selectedArtifactLightboxUrl, setSelectedArtifactLightboxUrl] = useState<string | null>(null);
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
  const [searchHistory, setSearchHistory] = useState<string[]>(() => readSearchHistory());
  const [recommendationPreferences, setRecommendationPreferences] = useState<string[]>(() => readRecommendationPreferences());
  const [preferenceProfile, setPreferenceProfile] = useState<UserPreferenceProfile>(() => readPreferenceProfile());

  // AI & Square State
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [exhibitionView, setExhibitionView] = useState<ExhibitionView>('ai');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<Partial<Exhibition> | null>(null);
  const [isCuratorTIQuizOpen, setIsCuratorTIQuizOpen] = useState(false);
  const [isSavingCuratorTI, setIsSavingCuratorTI] = useState(false);
  const [myExhibitions, setMyExhibitions] = useState<Exhibition[]>([]);
  const [squareExhibitions, setSquareExhibitions] = useState<Exhibition[]>([]);
  const [exploreTab, setExploreTab] = useState('推荐发现');
  const [resourceView, setResourceView] = useState<'overview' | 'artifacts' | 'museums' | 'eras' | 'collections' | 'types' | 'materials' | 'tags'>('overview');
  const [museumSubTab, setMuseumSubTab] = useState('中国国家博物馆');
  const [eraSubTab, setEraSubTab] = useState('全部');
  const [messageTab, setMessageTab] = useState<'reminders' | 'chats'>('reminders');
  const [isExhMultiSelect, setIsExhMultiSelect] = useState(false);
  const [selectedExhIds, setSelectedExhIds] = useState<string[]>([]);
  const [activeSidebarFeature, setActiveSidebarFeature] = useState<SidebarFeatureId | null>(null);
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
  const [aiInitialKeywords, setAiInitialKeywords] = useState('');
  const [toast, setToast] = useState<ToastState>(null);
  const layerHistoryPushedRef = useRef(false);
  const ignoreNextPopRef = useRef(false);

  const showToast = (message: string, tone: NonNullable<ToastState>['tone'] = 'info') => {
    setToast({ id: Date.now(), message, tone });
  };

  const openImmersiveExhibition = (exhibition: Exhibition | null) => {
    const normalized = normalizeExhibition(exhibition);
    if (!normalized) return;
    setIsSearching(false);
    setIsMessaging(false);
    setIsBGMGeneratorOpen(false);
    setIsMuseumSelectorOpen(false);
    setActiveSidebarFeature(null);
    setSelectedArtifact(null);
    setSelectedArtifactLightboxUrl(null);
    setSlideshowExhibition(normalized);
    setIsSlideshowOpen(true);
  };

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const refreshPreferenceProfile = (event?: Event) => {
      const customEvent = event as CustomEvent<UserPreferenceProfile>;
      setPreferenceProfile(customEvent?.detail || readPreferenceProfile());
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'muselink_user_preference_profile' || event.key === 'muselink_swipe_history') {
        setPreferenceProfile(readPreferenceProfile());
      }
    };
    window.addEventListener(PREFERENCE_PROFILE_UPDATED_EVENT, refreshPreferenceProfile as EventListener);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(PREFERENCE_PROFILE_UPDATED_EVENT, refreshPreferenceProfile as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const closeAIModal = useCallback(() => {
    setIsAIModalOpen(false);
    setAiResult(null);
    setAiInitialKeywords('');
  }, []);

  const closeManualExhibition = useCallback(() => {
    setIsManualExhibitionOpen(false);
  }, []);

  const closeEditExhibition = useCallback(() => {
    setIsEditExhibitionOpen(false);
    setEditingExhibition(null);
  }, []);

  const closeManageArtifacts = useCallback(() => {
    setIsManageArtifactsOpen(false);
  }, []);

  const closeBGMGenerator = useCallback(() => {
    setIsBGMGeneratorOpen(false);
    setBgmExhibition(null);
  }, []);

  const closeSlideshow = useCallback(() => {
    setIsSlideshowOpen(false);
    setSlideshowExhibition(null);
  }, []);

  const exitExhibitionMultiSelect = useCallback(() => {
    setIsExhMultiSelect(false);
    setSelectedExhIds([]);
  }, []);

  const closeTopLayer = useCallback(() => {
    if (isSlideshowOpen) {
      closeSlideshow();
      return true;
    }
    if (isBGMGeneratorOpen) {
      closeBGMGenerator();
      return true;
    }
    if (isManageArtifactsOpen) {
      closeManageArtifacts();
      return true;
    }
    if (isEditExhibitionOpen) {
      closeEditExhibition();
      return true;
    }
    if (isManualExhibitionOpen) {
      closeManualExhibition();
      return true;
    }
    if (isAIModalOpen) {
      closeAIModal();
      return true;
    }
    if (isCuratorTIQuizOpen) {
      setIsCuratorTIQuizOpen(false);
      return true;
    }
    if (isSettingsOpen) {
      setIsSettingsOpen(false);
      return true;
    }
    if (activeSidebarFeature) {
      setActiveSidebarFeature(null);
      return true;
    }
    if (isProfileEditOpen) {
      setIsProfileEditOpen(false);
      return true;
    }
    if (showSyncPrompt) {
      setShowSyncPrompt(false);
      return true;
    }
    if (isMuseumSelectorOpen) {
      setIsMuseumSelectorOpen(false);
      return true;
    }
    if (isExhMultiSelect) {
      exitExhibitionMultiSelect();
      return true;
    }
    if (selectedArtifactLightboxUrl) {
      setSelectedArtifactLightboxUrl(null);
      return true;
    }
    if (selectedArtifact) {
      setSelectedArtifact(null);
      setSelectedArtifactLightboxUrl(null);
      return true;
    }
    if (selectedExhibition) {
      setSelectedExhibition(null);
      return true;
    }
    if (isSearching) {
      setIsSearching(false);
      return true;
    }
    if (isMessaging) {
      setIsMessaging(false);
      return true;
    }
    if (isDrawerOpen) {
      setIsDrawerOpen(false);
      return true;
    }
    return false;
  }, [
    activeSidebarFeature,
    closeAIModal,
    closeBGMGenerator,
    closeEditExhibition,
    closeManageArtifacts,
    closeManualExhibition,
    closeSlideshow,
    exitExhibitionMultiSelect,
    isAIModalOpen,
    isBGMGeneratorOpen,
    isCuratorTIQuizOpen,
    isDrawerOpen,
    isEditExhibitionOpen,
    isExhMultiSelect,
    isManageArtifactsOpen,
    isManualExhibitionOpen,
    isMessaging,
    isMuseumSelectorOpen,
    isProfileEditOpen,
    isSearching,
    isSettingsOpen,
    isSlideshowOpen,
    selectedArtifact,
    selectedArtifactLightboxUrl,
    selectedExhibition,
    showSyncPrompt,
  ]);

  const hasOpenLayer = Boolean(
    isSlideshowOpen ||
      isBGMGeneratorOpen ||
      isManageArtifactsOpen ||
      isEditExhibitionOpen ||
      isManualExhibitionOpen ||
      isAIModalOpen ||
      isCuratorTIQuizOpen ||
      isSettingsOpen ||
      activeSidebarFeature ||
      isProfileEditOpen ||
      showSyncPrompt ||
      isMuseumSelectorOpen ||
      isExhMultiSelect ||
      selectedArtifactLightboxUrl ||
      selectedArtifact ||
      selectedExhibition ||
      isSearching ||
      isMessaging ||
      isDrawerOpen,
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (closeTopLayer()) {
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeTopLayer]);

  useEffect(() => {
    const onPopState = () => {
      if (ignoreNextPopRef.current) {
        ignoreNextPopRef.current = false;
        return;
      }
      if (!hasOpenLayer) return;
      layerHistoryPushedRef.current = false;
      closeTopLayer();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [closeTopLayer, hasOpenLayer]);

  useEffect(() => {
    if (hasOpenLayer && !layerHistoryPushedRef.current) {
      window.history.pushState({ ...(window.history.state || {}), muselinkLayer: true }, "", window.location.href);
      layerHistoryPushedRef.current = true;
      return;
    }

    if (!hasOpenLayer && layerHistoryPushedRef.current) {
      layerHistoryPushedRef.current = false;
      if (window.history.state?.muselinkLayer) {
        ignoreNextPopRef.current = true;
        window.history.back();
      }
    }
  }, [hasOpenLayer]);

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

    setSearchHistory(prev => {
      const next = rememberRecentText(prev, keyword);
      writeSearchHistory(next);
      return next;
    });
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
  const [filterPeriod, setFilterPeriod] = useState('全部');
  const [filterMuseum, setFilterMuseum] = useState('全部');
  const [filterCulture, setFilterCulture] = useState('全部');
  const [sortBy, setSortBy] = useState<'name' | 'favs' | 'era'>('favs');
  const [allArtifactsQuery, setAllArtifactsQuery] = useState('');
  const [allArtifactsVisibleCount, setAllArtifactsVisibleCount] = useState(ALL_ARTIFACT_PAGE_SIZE);

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

  const recommendedArtifactResults = useMemo(
    () => buildArtifactRecommendations(
      artifactPool,
      {
        favoriteArtifactIds: favorites,
        viewHistoryIds: history,
        searchKeywords: searchHistory,
        curationKeywords: recommendationPreferences,
        preferenceProfile,
      },
      RECOMMENDED_ARTIFACT_LIMIT,
    ),
    [artifactPool, favorites, history, preferenceProfile, recommendationPreferences, searchHistory]
  );

  const recommendedArtifacts = useMemo(
    () => recommendedArtifactResults.map((item) => item.artifact),
    [recommendedArtifactResults]
  );

  const hasSwipeHistory = useMemo(() => readSwipeHistory().length > 0, [preferenceProfile]);

  const artifactTagText = (tag: Artifact["tags"][number]) => {
    if (typeof tag === 'string') return tag.trim();
    return [tag.type, tag.name].filter(Boolean).join(' ').trim();
  };

  const countArtifactValues = useCallback((values: string[]) => {
    const counts = new Map<string, number>();
    values
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh-CN'));
  }, []);

  const resourceIndexes = useMemo(() => {
    const categories = countArtifactValues(artifactPool.map((artifact) => displayDbString(artifactCategoryRaw(artifact))).filter((value) => value !== '暂无信息'));
    const materials = countArtifactValues(artifactPool.map((artifact) => displayDbString(artifactMaterialRaw(artifact))).filter((value) => value !== '暂无信息'));
    const eras = countArtifactValues(artifactPool.map((artifact) => displayDbString(artifactEraRaw(artifact))).filter((value) => value !== '暂无信息'));
    const museums = countArtifactValues(artifactPool.map((artifact) => displayDbString(artifactMuseumRaw(artifact))).filter((value) => value !== '暂无信息'));
    const tags = countArtifactValues(artifactPool.flatMap((artifact) => (artifact.tags || []).map(artifactTagText)));
    return { categories, materials, eras, museums, tags };
  }, [artifactPool, countArtifactValues]);

  const editorRecommendedArtifacts = useMemo(
    () => artifactPool
      .slice()
      .sort((a, b) => {
        const imageA = String(artifactImageUrlRaw(a, "thumbnail") ?? '').trim() ? 1 : 0;
        const imageB = String(artifactImageUrlRaw(b, "thumbnail") ?? '').trim() ? 1 : 0;
        if (imageA !== imageB) return imageB - imageA;
        return (b.favsCount || 0) - (a.favsCount || 0);
      })
      .slice(0, 6),
    [artifactPool],
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
         imageUrl: '',
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

  const showResourceArtifacts = (options: {
    view?: typeof resourceView;
    museum?: string;
    era?: string;
    category?: string;
    material?: string;
    tag?: string;
  } = {}) => {
    setResourceView(options.view || 'artifacts');
    setAllArtifactsQuery('');
    setFilterMuseum(options.museum || '全部');
    setFilterPeriod(options.era || '全部');
    setFilterCulture('全部');
    setSortBy('favs');
    if (options.museum) setMuseumSubTab(options.museum);
    if (options.era) setEraSubTab(options.era);
    if (options.category || options.material || options.tag) {
      setAllArtifactsQuery(options.category || options.material || options.tag || '');
    }
  };

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
      showToast('收藏展览失败，请稍后重试。', 'error');
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
      showToast('展览已更新', 'success');
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : '更新展览失败，请稍后重试。', 'error');
    }
  };

  const handleDeleteExhibition = async (id: string) => {
    if (!user) return;
    try {
      await deleteExhibitionRequest(id);
      setMyExhibitions(prev => prev.filter(e => e.id !== id));
      setIsEditExhibitionOpen(false);
      setEditingExhibition(null);
      showToast('展览已删除', 'success');
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : '删除展览失败，请稍后重试。', 'error');
    }
  };

  const handleSaveCuratorTI = async (curatorTI: CuratorTI) => {
    if (!user) {
      goLogin();
      return;
    }

    setIsSavingCuratorTI(true);
    try {
      const updated = await updateMyProfile({ curatorTI });
      setUserProfile(prev => prev ? { ...prev, ...updated, curatorTI: updated.curatorTI || curatorTI } : updated);
      setIsCuratorTIQuizOpen(false);
      showToast('策展 TI 已保存', 'success');
    } catch (error) {
      console.error("Save curator TI error:", error);
      showToast(error instanceof Error ? error.message : '策展 TI 保存失败，请稍后重试。', 'error');
    } finally {
      setIsSavingCuratorTI(false);
    }
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
          curatorTI: me.profile?.curatorTI as CuratorTI | undefined,
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
    const handleOpenArtifact = (e: any) => {
      setSelectedArtifactLightboxUrl(null);
      setSelectedArtifact(e.detail);
    };
    
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
        showToast('收藏失败，请稍后重试。', 'error');
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

  const handleAIGenerate = async (
    keywords: string,
    generateBGM: boolean,
    guideAnswers: CuratorGuideAnswers = {},
  ) => {
    const preferenceText = [keywords, ...Object.values(guideAnswers)].join(' ').trim();
    if (preferenceText) {
      setRecommendationPreferences(prev => {
        const next = rememberRecentText(prev, preferenceText);
        writeRecommendationPreferences(next);
        return next;
      });
    }
    setIsGenerating(true);
    try {
      const backendArtifacts = await fetchBackendArtifactPool();
      const result = await curatorService.generateExhibition(keywords, backendArtifacts, { guideAnswers });
      const coverArtifact = backendArtifacts.find((artifact) => result.artifactIds?.includes(artifact.id));
      const coverUrl = result.coverUrl || coverArtifact?.imageUrl || '';
      const bgmUrl = generateBGM ? 'ambient://gallery' : undefined;
      setAiResult({ ...result, coverUrl, bgmUrl });
      if ((result as any).generationNotice) {
        showToast(String((result as any).generationNotice), 'info');
      }
    } catch (e) {
      console.error("AI Generation failed:", e);
      showToast(e instanceof Error ? e.message : '策展生成失败，请稍后重试。', 'error');
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
        aiCuration: aiResult.aiCuration,
        exhibitionIntro: aiResult.exhibitionIntro,
        units: aiResult.units,
        conclusion: aiResult.conclusion,
        selectionReasons: aiResult.selectionReasons,
        artifactRoles: aiResult.artifactRoles,
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
      showToast('已保存到我的策展', 'success');
    } catch (e) {
      console.error("Collection failed:", e);
      showToast(e instanceof Error ? e.message : '保存展览失败，请稍后重试。', 'error');
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
      showToast('请至少选择一件文物。', 'error');
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
      const manualPreference = [draft.title, draft.intro].join(' ').trim();
      if (manualPreference) {
        setRecommendationPreferences(prev => {
          const next = rememberRecentText(prev, manualPreference);
          writeRecommendationPreferences(next);
          return next;
        });
      }
      setSelectedExhibition(normalized);
      setIsManualExhibitionOpen(false);
      showToast('手动展览已创建', 'success');
    } catch (e) {
      console.error("Manual exhibition creation failed:", e);
      showToast(e instanceof Error ? e.message : '新建策展失败，请稍后重试。', 'error');
    } finally {
      setIsCreatingManualExhibition(false);
    }
  };

  useEffect(() => {
    const fetchExhibitions = async () => {
      try {
        const square = await fetchSquareExhibitions(50);
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

  const switchPrimaryTab = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'swipe') {
      window.location.hash = '#/swipe';
      return;
    }
    const target = tab === 'explore' ? '#/home' : `#/home?tab=${encodeURIComponent(tab)}`;
    if (window.location.hash !== target) {
      window.location.hash = target;
    }
  };

  const viewArtifactFavorites = () => {
    setProfileTab('收藏文物');
    switchPrimaryTab('profile');
  };

  const viewExhibitionFavorites = () => {
    setProfileTab('收藏展陈');
    switchPrimaryTab('profile');
  };

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden bg-[#F6F3EE] pb-[var(--app-bottom-nav-height)] font-sans selection:bg-amber-100 no-scrollbar">
      <Drawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        user={user} 
        onLoginClick={goLogin}
        onEditProfile={() => setIsProfileEditOpen(true)}
        onSettingsClick={() => setIsSettingsOpen(true)}
        onFeatureClick={(feature) => setActiveSidebarFeature(feature)}
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

      <main className="mx-auto min-h-[calc(100vh-149px)] max-w-2xl">
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
              <ExploreTabBar
                exploreTab={exploreTab}
                setExploreTab={(tab) => {
                  setExploreTab(tab);
                  if (tab === '文博资料') setResourceView('overview');
                }}
              />

              <div className="p-4 space-y-6 flex-1">
                <AnimatePresence mode="wait">
                  {exploreTab === '推荐发现' && (
                    <motion.div
                      key="recommend"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                      {/* 2. Personalized Artifact Recommendations */}
                      <div className="space-y-3">
                        <h2 className="text-lg font-bold text-secondary font-serif flex items-center gap-2 force-nowrap">
                          <Sparkles size={18} className="text-primary flex-shrink-0" />
                          为你推荐
                        </h2>
                        <Banner artifacts={recommendedArtifacts} />
                      </div>

                      <button
                        type="button"
                        onClick={() => switchPrimaryTab('swipe')}
                        className="group relative w-full overflow-hidden rounded-[8px] border border-amber-100 bg-gradient-to-br from-[#fbf7ee] via-white to-[#efe6d5] p-4 text-left shadow-xl shadow-stone-900/8 transition-all active:scale-[0.99]"
                      >
                        <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-amber-200/30 blur-2xl" />
                        <div className="relative grid grid-cols-[1fr_112px] gap-3">
                          <div className="min-w-0 space-y-3">
                            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-primary shadow-sm">
                              <Sparkles size={13} />
                              Swipe
                            </div>
                            <div className="space-y-1.5">
                              <h2 className="break-words text-xl font-black leading-tight text-gray-950">刷一刷，让推荐更懂你</h2>
                              <p className="break-words text-xs leading-relaxed text-gray-600">
                                通过左右滑文物，快速告诉 MuseLink 你的兴趣偏好
                              </p>
                              <p className="break-words text-[11px] font-bold leading-relaxed text-primary">
                                {hasSwipeHistory ? '已根据你的选择优化推荐，继续刷一刷让推荐更精准' : '刷 10 件文物，让推荐更懂你'}
                              </p>
                            </div>
                            <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-black text-white shadow-lg shadow-primary/20">
                              开始刷文物
                              <ArrowRight size={14} />
                            </span>
                          </div>

                          <div className="relative h-32">
                            {recommendedArtifacts.slice(0, 3).map((artifact, index) => (
                              <div
                                key={`swipe-entry-${artifact.id}`}
                                className={cn(
                                  "absolute top-2 h-24 w-20 overflow-hidden rounded-[6px] border border-white bg-white shadow-lg transition-transform group-active:scale-95",
                                  index === 0 && "right-7 rotate-[-8deg]",
                                  index === 1 && "right-3 top-5 rotate-[6deg]",
                                  index === 2 && "right-12 top-8 rotate-[-2deg]",
                                )}
                              >
                                <SafeImage
                                  src={String(artifactImageUrlRaw(artifact, "thumbnail") ?? '')}
                                  alt={displayDbString(artifactNameRaw(artifact))}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            ))}
                            <div className="absolute bottom-2 right-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-black text-primary shadow-sm">
                              左右滑
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* 3. Editor Artifact Recommendations */}
                      <div className="space-y-4">
                        <h2 className="text-lg font-bold text-secondary font-serif flex items-center gap-2 force-nowrap">
                          <BookmarkCheck size={18} className="text-primary flex-shrink-0" />
                          编辑推荐文物
                        </h2>

                        <div className="columns-2 gap-1.5">
                          {editorRecommendedArtifacts.map(artifact => (
                            <div key={`editor-artifact-${artifact.id}`} className="break-inside-avoid mb-1.5">
                              <ArtifactCard
                                artifact={artifact}
                                isFavorite={favorites.includes(artifact.id)}
                                onFavoriteClick={() => toggleFavorite(artifact.id)}
                                onClick={() => {
                                  setSelectedArtifact(artifact);
                                  addToHistory(artifact.id);
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 4. Discovery Section */}
                      <div className="space-y-4">
                        <h2 className="text-lg font-bold text-secondary font-serif flex items-center gap-2 force-nowrap">
                          <Sparkles size={18} className="text-primary flex-shrink-0" />
                          个性化推荐文物
                        </h2>
                        
                        <div className="columns-2 gap-1.5">
                          {recommendedArtifactResults.map(recommendation => (
                            <div key={recommendation.artifact.id} className="break-inside-avoid mb-1.5">
                              <ArtifactCard 
                                artifact={recommendation.artifact}
                                recommendation={recommendation}
                                isFavorite={favorites.includes(recommendation.artifact.id)}
                                onFavoriteClick={() => toggleFavorite(recommendation.artifact.id)}
                                onCurationClick={() => {
                                  const artifactName = displayDbString(artifactNameRaw(recommendation.artifact));
                                  const tags = recommendation.matchedTags.slice(0, 3).join('、');
                                  setAiResult(null);
                                  setAiInitialKeywords(`围绕“${artifactName}”生成一个主题展览${tags ? `，重点参考：${tags}` : ''}`);
                                  setIsAIModalOpen(true);
                                }}
                                onClick={() => {
                                  setSelectedArtifact(recommendation.artifact);
                                  addToHistory(recommendation.artifact.id);
                                }} 
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {exploreTab === '文博资料' && resourceView === 'overview' && (
                    <motion.div
                      key="resource-overview"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-5"
                    >
                      <section className="space-y-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">常用入口</p>
                          <h2 className="mt-1 text-lg font-bold text-gray-950">文博资料</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: '文物库', count: artifactPool.length, action: () => showResourceArtifacts({ view: 'artifacts' }) },
                            { label: '博物馆', count: resourceIndexes.museums.length, action: () => setResourceView('museums') },
                            { label: '年代', count: resourceIndexes.eras.length, action: () => setResourceView('eras') },
                            { label: '馆藏全览', count: filteredArtifacts.length, action: () => showResourceArtifacts({ view: 'artifacts' }) },
                          ].map((item) => (
                            <button
                              key={item.label}
                              type="button"
                              onClick={item.action}
                              className="min-h-24 rounded-[8px] border border-gray-100 bg-white p-4 text-left shadow-sm transition-all active:scale-[0.99]"
                            >
                              <p className="text-base font-black text-gray-950">{item.label}</p>
                              <p className="mt-2 text-[11px] font-bold text-primary">{item.count} 项</p>
                            </button>
                          ))}
                        </div>
                      </section>

                      <section className="space-y-3">
                        <h3 className="text-sm font-black text-gray-950">分类浏览</h3>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: '类型', value: resourceIndexes.categories[0]?.label, action: () => setResourceView('types') },
                            { label: '材质', value: resourceIndexes.materials[0]?.label, action: () => setResourceView('materials') },
                            { label: '朝代', value: resourceIndexes.eras[0]?.label, action: () => setResourceView('eras') },
                            { label: '标签', value: resourceIndexes.tags[0]?.label, action: () => setResourceView('tags') },
                          ].map((item) => (
                            <button
                              key={item.label}
                              type="button"
                              onClick={item.action}
                              className="rounded-[8px] border border-gray-100 bg-white p-3 text-left shadow-sm active:scale-[0.99]"
                            >
                              <p className="text-sm font-black text-gray-950">{item.label}</p>
                              <p className="mt-1 line-clamp-1 text-[10px] font-bold text-gray-400">{item.value || '暂无数据'}</p>
                            </button>
                          ))}
                        </div>
                      </section>

                      <section className="space-y-3">
                        <h3 className="text-sm font-black text-gray-950">高频标签 / 热门馆藏地</h3>
                        <div className="flex flex-wrap gap-2">
                          {[...resourceIndexes.tags.slice(0, 8), ...resourceIndexes.museums.slice(0, 5)].map((item) => (
                            <button
                              key={`${item.label}-${item.count}`}
                              type="button"
                              onClick={() => {
                                if (resourceIndexes.museums.some((museum) => museum.label === item.label)) {
                                  showResourceArtifacts({ view: 'artifacts', museum: item.label });
                                } else {
                                  showResourceArtifacts({ view: 'artifacts', tag: item.label });
                                }
                              }}
                              className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-gray-700 shadow-sm active:scale-[0.98]"
                            >
                              {item.label}
                              <span className="ml-1 text-gray-300">{item.count}</span>
                            </button>
                          ))}
                        </div>
                      </section>
                    </motion.div>
                  )}

                  {exploreTab === '文博资料' && ['types', 'materials', 'tags'].includes(resourceView) && (
                    <motion.div
                      key={`resource-${resourceView}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-4"
                    >
                      <button
                        type="button"
                        onClick={() => setResourceView('overview')}
                        className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-gray-500 shadow-sm"
                      >
                        返回文博资料
                      </button>
                      <div className="grid grid-cols-2 gap-2">
                        {(resourceView === 'types' ? resourceIndexes.categories : resourceView === 'materials' ? resourceIndexes.materials : resourceIndexes.tags).slice(0, 40).map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => showResourceArtifacts({
                              view: 'artifacts',
                              category: resourceView === 'types' ? item.label : undefined,
                              material: resourceView === 'materials' ? item.label : undefined,
                              tag: resourceView === 'tags' ? item.label : undefined,
                            })}
                            className="rounded-[8px] border border-gray-100 bg-white p-3 text-left shadow-sm active:scale-[0.99]"
                          >
                            <p className="line-clamp-2 text-sm font-black text-gray-950">{item.label}</p>
                            <p className="mt-1 text-[10px] font-bold text-primary">{item.count} 件相关文物</p>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {exploreTab === '文博资料' && resourceView === 'artifacts' && (
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

                  {exploreTab === '文博资料' && resourceView === 'museums' && (
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

                  {exploreTab === '文博资料' && resourceView === 'eras' && (
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

          {activeTab === 'swipe' && (
            <motion.div
              key="swipe"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="min-h-screen bg-[var(--app-page-bg)]"
            >
              <ArtifactSwipePage
                artifacts={artifactPool}
                exhibitions={squareExhibitions}
                favoriteArtifactIds={favorites}
                favoriteExhibitionIds={favExhibitionIds}
                preferenceProfile={preferenceProfile}
                onToggleArtifactFavorite={toggleFavorite}
                onToggleExhibitionFavorite={toggleExhibitionFavorite}
                onOpenArtifact={(artifact) => {
                  setSelectedArtifactLightboxUrl(null);
                  setSelectedArtifact(artifact);
                }}
                onOpenExhibition={(exhibition) => setSelectedExhibition(exhibition)}
                onViewArtifactFavorites={viewArtifactFavorites}
                onViewExhibitionFavorites={viewExhibitionFavorites}
                onBackToExplore={() => switchPrimaryTab('explore')}
              />
            </motion.div>
          )}

          {activeTab === 'exhibition' && (
            <motion.div
              key="exhibition"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="min-h-screen bg-[var(--app-page-bg)]"
            >
              <ExhibitionTopTabs value={exhibitionView} onChange={setExhibitionView} />

              {exhibitionView === 'ai' && (
                <AICurationEntry
                  curatorTI={userProfile?.curatorTI}
                  onOpen={() => setIsAIModalOpen(true)}
                  onOpenQuiz={() => setIsCuratorTIQuizOpen(true)}
                />
              )}

              {exhibitionView === 'mine' && (
                <div className="space-y-5 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Library size={18} className="text-primary flex-shrink-0" />
                      <h2 className="text-lg font-bold text-secondary font-serif force-nowrap">我的策展</h2>
                    </div>
                    {user && <span className="text-[10px] font-bold text-primary bg-neutral px-2 py-0.5 rounded-full border border-gray-100 force-nowrap">{myExhibitions.length}</span>}
                  </div>

                  {user ? (
                    <div className="grid grid-cols-1 gap-4">
                      <button
                        type="button"
                        onClick={() => setIsAIModalOpen(true)}
                        className="flex min-h-20 items-center justify-center gap-2 rounded-[5px] border border-primary/10 bg-neutral text-xs font-bold text-primary shadow-sm transition-all hover:bg-primary hover:text-white"
                      >
                        <Sparkles size={18} />
                        生成个人展览
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsManualExhibitionOpen(true)}
                        className="text-center text-[10px] font-bold text-gray-400 transition-colors hover:text-primary"
                      >
                        手动新建
                      </button>
                      {myExhibitions.map(exh => (
                        <ExhibitionCard
                          key={exh.id}
                          exhibition={exh}
                          onClick={() => setSelectedExhibition(exh)}
                        />
                      ))}
                      {myExhibitions.length === 0 && (
                        <div className="space-y-3 rounded-[5px] border border-gray-100 bg-white py-12 text-center">
                          <p className="text-xs font-bold text-gray-500">还没有自己的展览</p>
                          <p className="text-[10px] text-gray-400">用一句话或几个问题，让 AI 生成第一个个人展览。</p>
                          <button
                            type="button"
                            onClick={() => setIsAIModalOpen(true)}
                            className="mx-auto rounded-[5px] bg-primary px-4 py-2 text-[10px] font-bold text-white shadow-md shadow-primary/20"
                          >
                            用 AI 生成第一个展览
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center space-y-3 rounded-[5px] border border-gray-100 bg-white py-12 text-center">
                      <p className="text-xs text-gray-400 force-nowrap">登录后查看我的策展</p>
                      <button onClick={goLogin} className="px-6 py-2 bg-primary text-white rounded-[5px] text-[10px] font-bold shadow-md shadow-primary/20 force-nowrap">立即登录</button>
                    </div>
                  )}
                </div>
              )}

              {exhibitionView === 'square' && (
                <div id="exhibition-square" className="space-y-6 p-4">
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
                  {squareExhibitions.length === 0 && (
                    <div className="rounded-[5px] border border-gray-100 bg-white py-14 text-center">
                      <p className="text-xs font-bold text-gray-500">展陈广场还没有公开展览</p>
                      <p className="mt-1 text-[10px] text-gray-400">保存个人展览后，可以在编辑中选择公开发布。</p>
                    </div>
                  )}
                </div>
              )}
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
                  <ProfileHeader
                    userProfile={userProfile}
                    onOpenCuratorTIQuiz={() => setIsCuratorTIQuizOpen(true)}
                  />

                  {/* Profile Tabs */}
                  <ProfileTabBar
                    profileTab={profileTab}
                    setProfileTab={setProfileTab}
                    favoriteArtifactsCount={favoriteArtifacts.length}
                    myExhibitionsCount={myExhibitions.length}
                    favExhibitionIdsCount={favExhibitionIds.length}
                  />

                  <div className="p-4 space-y-4">
                    <div className="space-y-4">
                      {profileTab === '收藏文物' && (
                        <div className="space-y-8">
                          <div className="space-y-6">
                            <div className="flex items-center justify-between px-2">
                              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest force-nowrap">我的收藏</h4>
                              <span className="text-[10px] font-bold text-gray-300 force-nowrap">{favoriteArtifacts.length} 件</span>
                            </div>
                            <div className="columns-2 gap-3">
                              {favoriteArtifacts
                                .map(artifact => (
                                  <div key={`fav-wrapper-${artifact.id}`} className="mb-3 break-inside-avoid">
                                    <ArtifactCard artifact={artifact} onClick={() => setSelectedArtifact(artifact)} />
                                  </div>
                                ))
                              }
                            </div>
                            {favoriteArtifacts.length === 0 && (
                              <div className="space-y-3 rounded-[5px] border border-gray-100 bg-white py-12 text-center">
                                <p className="text-xs font-bold text-gray-500">还没有收藏文物</p>
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('explore')}
                                  className="rounded-[5px] bg-neutral px-4 py-2 text-[10px] font-bold text-primary"
                                >
                                  去探索馆藏
                                </button>
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

                          {myExhibitions.length > 0 ? (
                            <div className="columns-2 gap-3">
                              {myExhibitions.map(exh => (
                                <div key={`my-exh-wrapper-${exh.id}`} className="relative mb-3 break-inside-avoid">
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
                                        "absolute top-4 right-4 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all",
                                        selectedExhIds.includes(exh.id) ? "bg-amber-800 border-amber-800 text-white" : "bg-white/80 border-white text-transparent"
                                      )}
                                    >
                                      <Plus size={14} className={cn(selectedExhIds.includes(exh.id) && "rotate-45")} />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                              <div key="no-my-exhibitions" className="space-y-3 rounded-[5px] border border-gray-100 bg-white py-12 text-center">
                                <p className="text-xs font-bold text-gray-500">还没有自建展陈</p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveTab('exhibition');
                                    setExhibitionView('ai');
                                    setIsAIModalOpen(true);
                                  }}
                                  className="rounded-[5px] bg-primary px-4 py-2 text-[10px] font-bold text-white"
                                >
                                  用 AI 生成个人展览
                                </button>
                              </div>
                          )}
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

                          {favoriteExhibitions.length > 0 ? (
                            <div className="columns-2 gap-3">
                              {favoriteExhibitions.map(exh => {
                                const id = exh.id;
                                return (
                                  <div key={`fav-exh-wrapper-${id}`} className="relative mb-3 break-inside-avoid">
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
                                          "absolute top-4 right-4 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all",
                                          selectedExhIds.includes(id) ? "bg-amber-800 border-amber-800 text-white" : "bg-white/80 border-white text-transparent"
                                        )}
                                      >
                                        <Plus size={14} className={cn(selectedExhIds.includes(id) && "rotate-45")} />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                              <div key="no-fav-exhibitions" className="space-y-3 rounded-[5px] border border-gray-100 bg-white py-12 text-center">
                                <p className="text-xs font-bold text-gray-500">还没有收藏展陈</p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveTab('exhibition');
                                    setExhibitionView('square');
                                  }}
                                  className="rounded-[5px] bg-neutral px-4 py-2 text-[10px] font-bold text-primary"
                                >
                                  去展陈广场看看
                                </button>
                              </div>
                          )}
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

      {activeTab !== 'swipe' && (
        <BottomNav activeTab={activeTab} setActiveTab={switchPrimaryTab} />
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            className="fixed left-4 right-4 top-5 z-[260] mx-auto flex max-w-md items-center gap-3 rounded-[5px] border border-gray-100 bg-white p-3 shadow-2xl"
          >
            <div className={cn(
              "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full",
              toast.tone === 'success' ? "bg-emerald-50 text-emerald-600" : toast.tone === 'error' ? "bg-rose-50 text-rose-500" : "bg-amber-50 text-primary"
            )}>
              {toast.tone === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            </div>
            <p className="min-w-0 flex-1 break-words text-xs font-bold leading-relaxed text-gray-700">{toast.message}</p>
            <button type="button" onClick={() => setToast(null)} className="rounded-full p-1 text-gray-300 hover:bg-gray-50 hover:text-gray-500">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlays */}
      <AIExhibitionModal 
        isOpen={isAIModalOpen}
        onClose={closeAIModal}
        onGenerate={(keywords, generateBGM, guideAnswers) => handleAIGenerate(keywords, generateBGM, guideAnswers)}
        isGenerating={isGenerating}
        result={aiResult}
        onCollect={handleAICollect}
        onManualCreate={() => {
          setIsAIModalOpen(false);
          setAiResult(null);
          setIsManualExhibitionOpen(true);
        }}
        artifacts={artifactPool}
        initialKeywords={aiInitialKeywords}
      />

      <CuratorTIQuiz
        isOpen={isCuratorTIQuizOpen}
        initialAnswers={userProfile?.curatorTI?.answers}
        isSaving={isSavingCuratorTI}
        onClose={() => setIsCuratorTIQuizOpen(false)}
        onSave={handleSaveCuratorTI}
      />

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <ProfileFeaturePanel
        isOpen={Boolean(activeSidebarFeature)}
        feature={activeSidebarFeature}
        onClose={() => setActiveSidebarFeature(null)}
        onCreateCuration={(keywords) => {
          setActiveSidebarFeature(null);
          setAiResult(null);
          setAiInitialKeywords(keywords);
          setIsAIModalOpen(true);
          showToast("已带入策展主题，可以继续调整后生成。", "success");
        }}
      />

      <ManualExhibitionModal
        isOpen={isManualExhibitionOpen}
        onClose={closeManualExhibition}
        onCreate={handleCreateManualExhibition}
        artifacts={artifactPool}
        isCreating={isCreatingManualExhibition}
      />

      <EditExhibitionModal 
        isOpen={isEditExhibitionOpen} 
        onClose={closeEditExhibition} 
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
        onClose={closeManageArtifacts}
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
            setResourceView={setResourceView}
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
            onClose={closeBGMGenerator}
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
            onClose={() => {
              setSelectedArtifact(null);
              setSelectedArtifactLightboxUrl(null);
            }} 
            allArtifacts={artifactPool}
            isFavorite={favorites.includes(selectedArtifact.id)}
            toggleFavorite={toggleFavorite}
            onArtifactClick={(a: Artifact) => {
              setSelectedArtifactLightboxUrl(null);
              setSelectedArtifact(a);
            }}
            lightboxUrl={selectedArtifactLightboxUrl}
            setLightboxUrl={setSelectedArtifactLightboxUrl}
          />
        )}
      </AnimatePresence>

      {isSlideshowOpen && activeSlideshowExhibition && (
        <SlideshowOverlay 
          key={`immersive-${activeSlideshowExhibition.id}`}
          isOpen={isSlideshowOpen}
          onClose={() => {
            closeSlideshow();
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
