import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronRight,
  Clock,
  Mail,
  MapPin,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import {
  aboutMuseLink,
  copyrightStatements,
  curationTemplates,
  dynastyTimeline,
  exhibitionBriefs,
  faqItems,
  helpBlocks,
  knowledgeEntries,
  sidebarFeatureMeta,
  sourceList,
  type ExhibitionBrief,
  type KnowledgeEntry,
  type SidebarFeatureId,
} from "../data/sidebarContent";

const FAVORITE_EXHIBITION_KEY = "muselink_sidebar_exhibition_favorites";
const FEEDBACK_KEY = "muselink_feedback_items";

type FeedbackItem = {
  id: string;
  content: string;
  createdAt: string;
};

function readStringArray(key: string) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function readFeedbackItems() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is FeedbackItem => Boolean(item?.id && item?.content)) : [];
  } catch {
    return [];
  }
}

const SectionTitle = ({ eyebrow, title }: { eyebrow: string; title: string }) => (
  <div className="space-y-1 px-1">
    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{eyebrow}</p>
    <h3 className="text-base font-bold text-gray-950">{title}</h3>
  </div>
);

const EmptyState = ({ title, body }: { title: string; body: string }) => (
  <div className="rounded-[5px] border border-dashed border-gray-200 bg-white/70 p-5 text-center">
    <p className="text-sm font-bold text-gray-800">{title}</p>
    <p className="mt-2 text-xs leading-relaxed text-gray-500">{body}</p>
  </div>
);

function ExhibitionCard({
  item,
  isFavorite,
  isExpanded,
  onToggleFavorite,
  onToggleExpand,
  onCreateCuration,
}: {
  item: ExhibitionBrief;
  isFavorite: boolean;
  isExpanded: boolean;
  onToggleFavorite: () => void;
  onToggleExpand: () => void;
  onCreateCuration: () => void;
}) {
  return (
    <article className="ios-card overflow-hidden border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="break-words text-base font-bold leading-snug text-gray-950">{item.title}</h4>
          <div className="mt-3 space-y-1.5 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-primary" />
              <span className="min-w-0 flex-1 break-words">{item.venue}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-primary" />
              <span>{item.time}</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleFavorite}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
            isFavorite ? "bg-amber-100 text-amber-700" : "bg-gray-50 text-gray-400",
          )}
          title={isFavorite ? "取消收藏" : "收藏展讯"}
        >
          {isFavorite ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
        </button>
      </div>
      <p className={cn("mt-3 text-xs leading-relaxed text-gray-600", !isExpanded && "line-clamp-3")}>{item.intro}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {item.tags.map((tag) => (
          <span key={tag} className="rounded-full bg-[#F6F3EE] px-2.5 py-1 text-[10px] font-bold text-primary">
            {tag}
          </span>
        ))}
      </div>
      {isExpanded && (
        <div className="mt-4 rounded-[5px] bg-amber-50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">可策展线索</p>
          <ul className="mt-2 space-y-1.5">
            {item.highlights.map((highlight) => (
              <li key={highlight} className="text-xs leading-relaxed text-amber-950">
                {highlight}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <button type="button" onClick={onToggleExpand} className="ios-button-medium bg-gray-50 text-xs font-bold text-gray-700">
          {isExpanded ? "收起" : "查看详情"}
        </button>
        <button type="button" onClick={onToggleFavorite} className="ios-button-medium bg-gray-50 text-xs font-bold text-gray-700">
          {isFavorite ? "已收藏" : "收藏"}
        </button>
        <button
          type="button"
          onClick={onCreateCuration}
          className="ios-button-medium flex items-center justify-center gap-1 bg-primary px-2 text-xs font-bold text-white"
        >
          <Sparkles size={14} />
          策展
        </button>
      </div>
    </article>
  );
}

function KnowledgeDetail({ entry }: { entry: KnowledgeEntry }) {
  return (
    <div className="ios-card border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{entry.category}</p>
      <h4 className="mt-1 text-lg font-bold text-gray-950">{entry.title}</h4>
      <p className="mt-3 text-xs leading-relaxed text-gray-600">{entry.detail}</p>
      <div className="mt-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">相关例子</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {entry.examples.map((example) => (
            <span key={example} className="rounded-full bg-gray-50 px-2.5 py-1 text-[10px] font-bold text-gray-600">
              {example}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProfileFeaturePanel({
  isOpen,
  feature,
  onClose,
  onCreateCuration,
}: {
  isOpen: boolean;
  feature: SidebarFeatureId | null;
  onClose: () => void;
  onCreateCuration: (keywords: string) => void;
}) {
  const [expandedExhibitionId, setExpandedExhibitionId] = useState<string | null>(exhibitionBriefs[0]?.id || null);
  const [favoriteExhibitionIds, setFavoriteExhibitionIds] = useState<string[]>(() => readStringArray(FAVORITE_EXHIBITION_KEY));
  const [knowledgeQuery, setKnowledgeQuery] = useState("");
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState(knowledgeEntries[0]?.id || "");
  const [openFaqIndex, setOpenFaqIndex] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>(() => readFeedbackItems());
  const [feedbackMessage, setFeedbackMessage] = useState("");

  useEffect(() => {
    if (isOpen) setFeedbackMessage("");
  }, [isOpen, feature]);

  const meta = feature ? sidebarFeatureMeta[feature] : null;

  const filteredKnowledge = useMemo(() => {
    const query = knowledgeQuery.trim().toLowerCase();
    if (!query) return knowledgeEntries;
    return knowledgeEntries.filter((entry) => (
      [entry.title, entry.category, entry.summary, entry.detail, ...entry.examples].join(" ").toLowerCase().includes(query)
    ));
  }, [knowledgeQuery]);

  const selectedKnowledge = knowledgeEntries.find((entry) => entry.id === selectedKnowledgeId) || filteredKnowledge[0] || null;

  const toggleFavoriteExhibition = (id: string) => {
    setFavoriteExhibitionIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [id, ...prev];
      localStorage.setItem(FAVORITE_EXHIBITION_KEY, JSON.stringify(next));
      return next;
    });
  };

  const submitFeedback = () => {
    const content = feedbackText.trim();
    if (!content) {
      setFeedbackMessage("请先写下你遇到的问题或建议。");
      return;
    }
    const nextItem: FeedbackItem = {
      id: `${Date.now()}`,
      content,
      createdAt: new Date().toLocaleString("zh-CN"),
    };
    const next = [nextItem, ...feedbackItems].slice(0, 8);
    setFeedbackItems(next);
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(next));
    setFeedbackText("");
    setFeedbackMessage("反馈已保存到本地，感谢你的建议。");
  };

  const renderNews = () => (
    <div className="space-y-4">
      <SectionTitle eyebrow="Exhibitions" title="近期可关注展讯" />
      {exhibitionBriefs.length === 0 ? (
        <EmptyState title="暂无展讯" body="本地 mock 数据为空，后续接入展览接口后会展示馆方实时内容。" />
      ) : (
        exhibitionBriefs.map((item) => (
          <ExhibitionCard
            key={item.id}
            item={item}
            isFavorite={favoriteExhibitionIds.includes(item.id)}
            isExpanded={expandedExhibitionId === item.id}
            onToggleFavorite={() => toggleFavoriteExhibition(item.id)}
            onToggleExpand={() => setExpandedExhibitionId((prev) => (prev === item.id ? null : item.id))}
            onCreateCuration={() => onCreateCuration(`围绕“${item.title}”策划一个相关主题展，重点参考：${item.tags.join("、")}`)}
          />
        ))
      )}
    </div>
  );

  const renderKnowledge = () => (
    <div className="space-y-5">
      <div className="relative">
        <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={knowledgeQuery}
          onChange={(event) => setKnowledgeQuery(event.target.value)}
          placeholder="搜索分类、术语、例子"
          className="ios-input w-full bg-white py-3 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/15"
        />
      </div>
      {filteredKnowledge.length === 0 ? (
        <EmptyState title="没有匹配的知识条目" body="换一个关键词试试，例如“青铜器”“递藏”“陶瓷”或“出土语境”。" />
      ) : (
        <>
          <div className="space-y-2">
            <SectionTitle eyebrow="Knowledge" title="文物分类与基础术语" />
            <div className="space-y-2">
              {filteredKnowledge.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedKnowledgeId(entry.id)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-[5px] border bg-white p-3 text-left transition-colors",
                    selectedKnowledge?.id === entry.id ? "border-primary/30 bg-amber-50" : "border-gray-100",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-gray-400">{entry.category}</p>
                    <h4 className="mt-1 text-sm font-bold text-gray-900">{entry.title}</h4>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500">{entry.summary}</p>
                  </div>
                  <ChevronRight size={16} className="mt-4 shrink-0 text-gray-300" />
                </button>
              ))}
            </div>
          </div>
          {selectedKnowledge && <KnowledgeDetail entry={selectedKnowledge} />}
        </>
      )}
      <div className="space-y-3">
        <SectionTitle eyebrow="Timeline" title="朝代时间线" />
        <div className="space-y-2">
          {dynastyTimeline.map((node) => (
            <div key={node.name} className="rounded-[5px] border border-gray-100 bg-white p-3">
              <div className="flex items-baseline justify-between gap-3">
                <h4 className="text-sm font-bold text-gray-900">{node.name}</h4>
                <span className="text-[10px] font-bold text-primary">{node.range}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">{node.note}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <SectionTitle eyebrow="Templates" title="策展主题模板" />
        {curationTemplates.map((template) => (
          <div key={template.id} className="ios-card border border-gray-100 bg-white p-4 shadow-sm">
            <h4 className="text-sm font-bold text-gray-950">{template.title}</h4>
            <p className="mt-2 text-xs leading-relaxed text-gray-500">{template.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {template.sections.map((section) => (
                <span key={section} className="rounded-full bg-gray-50 px-2.5 py-1 text-[10px] font-bold text-gray-600">
                  {section}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onCreateCuration(`使用“${template.title}”模板生成一个文博主题展，结构包括：${template.sections.join("、")}`)}
              className="ios-button-medium mt-4 flex w-full items-center justify-center gap-2 bg-primary text-xs font-bold text-white"
            >
              <Sparkles size={14} />
              用此模板生成策展
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderHelp = () => (
    <div className="space-y-5">
      <div className="space-y-3">
        <SectionTitle eyebrow="Guide" title="核心使用流程" />
        {helpBlocks.map((block) => (
          <article key={block.title} className="ios-card border border-gray-100 bg-white p-4 shadow-sm">
            <h4 className="text-sm font-bold text-gray-950">{block.title}</h4>
            <p className="mt-2 text-xs leading-relaxed text-gray-600">{block.body}</p>
            <ol className="mt-3 space-y-2">
              {block.steps.map((step, index) => (
                <li key={step} className="flex gap-2 text-xs leading-relaxed text-gray-600">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F6F3EE] text-[10px] font-bold text-primary">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </article>
        ))}
      </div>
      <div className="space-y-3">
        <SectionTitle eyebrow="FAQ" title="常见问题" />
        {faqItems.map((item, index) => (
          <button
            key={item.question}
            type="button"
            onClick={() => setOpenFaqIndex((prev) => (prev === index ? -1 : index))}
            className="w-full rounded-[5px] border border-gray-100 bg-white p-4 text-left"
          >
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-bold text-gray-900">{item.question}</h4>
              <ChevronDown className={cn("shrink-0 text-gray-300 transition-transform", openFaqIndex === index && "rotate-180")} size={16} />
            </div>
            {openFaqIndex === index && <p className="mt-3 text-xs leading-relaxed text-gray-500">{item.answer}</p>}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        <SectionTitle eyebrow="Feedback" title="反馈给项目组" />
        <div className="ios-card border border-gray-100 bg-white p-4 shadow-sm">
          <textarea
            value={feedbackText}
            onChange={(event) => setFeedbackText(event.target.value)}
            placeholder="写下你遇到的问题、希望新增的文物类型或对 AI 策展结果的建议"
            className="min-h-28 w-full resize-none bg-gray-50 p-3 text-sm outline-none focus:ring-2 focus:ring-primary/15"
          />
          {feedbackMessage && <p className="mt-2 text-xs font-bold text-primary">{feedbackMessage}</p>}
          <button
            type="button"
            onClick={submitFeedback}
            className="ios-button-large mt-3 flex w-full items-center justify-center gap-2 bg-primary text-sm font-bold text-white shadow-lg shadow-primary/20"
          >
            <Send size={16} />
            提交反馈
          </button>
        </div>
        {feedbackItems.length === 0 ? (
          <EmptyState title="暂无本地反馈记录" body="提交后的反馈会先保存在当前浏览器 localStorage，后续可接入后端反馈接口。" />
        ) : (
          <div className="space-y-2">
            {feedbackItems.map((item) => (
              <div key={item.id} className="rounded-[5px] border border-gray-100 bg-white p-3">
                <p className="text-xs leading-relaxed text-gray-700">{item.content}</p>
                <p className="mt-2 text-[10px] text-gray-400">{item.createdAt}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderCopyright = () => (
    <div className="space-y-5">
      <div className="ios-card border border-gray-100 bg-white p-4 shadow-sm">
        <h3 className="text-base font-bold text-gray-950">使用边界</h3>
        <div className="mt-3 space-y-3">
          {copyrightStatements.map((statement) => (
            <p key={statement} className="text-xs leading-relaxed text-gray-600">{statement}</p>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <SectionTitle eyebrow="Sources" title="主要来源类型" />
        {sourceList.map((source) => (
          <div key={source} className="flex items-center gap-3 rounded-[5px] border border-gray-100 bg-white p-3">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <p className="min-w-0 flex-1 text-xs font-bold leading-relaxed text-gray-700">{source}</p>
          </div>
        ))}
      </div>
      <div className="rounded-[5px] border border-amber-100 bg-amber-50 p-4">
        <p className="text-sm font-bold text-amber-950">非商用提示</p>
        <p className="mt-2 text-xs leading-relaxed text-amber-900">
          MuseLink 当前内容仅用于学习、展示和 AI 策展 Demo。正式发布或对外商用前，必须逐项核对文物数据、图片授权、馆方署名和生成文本准确性。
        </p>
      </div>
    </div>
  );

  const renderAbout = () => (
    <div className="space-y-5">
      <div className="ios-card border border-gray-100 bg-white p-5 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary">MuseLink</p>
        <h3 className="mt-2 text-xl font-bold text-gray-950">博悟，连接文物与人的策展表达</h3>
        <p className="mt-3 text-xs leading-relaxed text-gray-600">{aboutMuseLink.what}</p>
      </div>
      <div className="ios-card border border-gray-100 bg-white p-4 shadow-sm">
        <h4 className="text-sm font-bold text-gray-950">项目目标</h4>
        <p className="mt-2 text-xs leading-relaxed text-gray-600">{aboutMuseLink.goal}</p>
      </div>
      <div className="space-y-3">
        <SectionTitle eyebrow="Features" title="核心功能" />
        <div className="grid grid-cols-2 gap-2">
          {aboutMuseLink.features.map((featureName) => (
            <div key={featureName} className="rounded-[5px] border border-gray-100 bg-white p-3 text-xs font-bold text-gray-700">
              {featureName}
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <SectionTitle eyebrow="Team" title="团队介绍" />
        {aboutMuseLink.team.map((item) => (
          <p key={item} className="rounded-[5px] border border-gray-100 bg-white p-3 text-xs leading-relaxed text-gray-600">{item}</p>
        ))}
      </div>
      <div className="ios-card border border-gray-100 bg-white p-4 shadow-sm">
        <h4 className="text-sm font-bold text-gray-950">技术栈</h4>
        <div className="mt-3 flex flex-wrap gap-2">
          {aboutMuseLink.techStack.map((item) => (
            <span key={item} className="rounded-full bg-gray-50 px-2.5 py-1 text-[10px] font-bold text-gray-600">{item}</span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[5px] border border-gray-100 bg-white p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Version</p>
          <p className="mt-1 text-sm font-bold text-gray-900">{aboutMuseLink.version}</p>
        </div>
        <div className="rounded-[5px] border border-gray-100 bg-white p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Contact</p>
          <p className="mt-1 flex items-center gap-1 break-all text-xs font-bold text-gray-900">
            <Mail size={13} />
            {aboutMuseLink.contact}
          </p>
        </div>
      </div>
    </div>
  );

  const renderBody = () => {
    if (feature === "news") return renderNews();
    if (feature === "knowledge") return renderKnowledge();
    if (feature === "help") return renderHelp();
    if (feature === "copyright") return renderCopyright();
    if (feature === "about") return renderAbout();
    return null;
  };

  return (
    <AnimatePresence>
      {isOpen && feature && meta && (
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          className="fixed inset-0 z-[210] flex flex-col overflow-hidden bg-[var(--app-page-bg)]"
        >
          <div className="ios-title-bar flex shrink-0 items-center gap-3 border-b border-gray-100 bg-[var(--app-bar-bg)] px-4 backdrop-blur-xl">
            <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-white">
              <ArrowLeft size={22} />
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-bold text-gray-950">{meta.title}</h2>
              <p className="mt-0.5 truncate text-[10px] text-gray-400">{meta.subtitle}</p>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 no-scrollbar">
            {renderBody()}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
