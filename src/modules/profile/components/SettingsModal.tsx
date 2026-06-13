import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  Check,
  Image,
  Lightbulb,
  Moon,
  Palette,
  RotateCcw,
  Sun,
  Type,
} from "lucide-react";
import { cn } from "../../../lib/utils";

const SETTINGS_KEY = "muselink_general_settings";

type ThemeMode = "light" | "dark";
type FontSize = "small" | "medium" | "large";

type GeneralSettings = {
  mode: ThemeMode;
  themeColor: string;
  fontSize: FontSize;
  showTips: boolean;
  imageFallback: boolean;
};

const defaultSettings: GeneralSettings = {
  mode: "light",
  themeColor: "#8C7851",
  fontSize: "medium",
  showTips: true,
  imageFallback: true,
};

const themeOptions = [
  { label: "经典金", value: "#8C7851" },
  { label: "瓷青", value: "#25636A" },
  { label: "石绿", value: "#2F6F4E" },
  { label: "朱砂", value: "#9A3E2F" },
];

const fontSizeOptions: Array<{ label: string; value: FontSize; hint: string }> = [
  { label: "小", value: "small", hint: "紧凑" },
  { label: "中", value: "medium", hint: "默认" },
  { label: "大", value: "large", hint: "易读" },
];

function readSettings(): GeneralSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return { ...defaultSettings, ...parsed };
  } catch {
    return defaultSettings;
  }
}

function applySettings(settings: GeneralSettings) {
  const root = document.getElementById("root");
  const target = root || document.documentElement;
  const primary = settings.themeColor;
  const isDark = settings.mode === "dark";
  const fontSize = settings.fontSize === "small" ? "15px" : settings.fontSize === "large" ? "17px" : "16px";

  target.style.setProperty("--color-primary", primary);
  target.style.setProperty("--app-page-bg", isDark ? "#171717" : "#F6F3EE");
  target.style.setProperty("--app-bar-bg", isDark ? "rgba(23, 23, 23, 0.92)" : "rgba(246, 243, 238, 0.92)");
  target.style.setProperty("--app-card-bg", isDark ? "rgba(38, 38, 38, 0.86)" : "rgba(255, 255, 255, 0.84)");
  document.documentElement.style.fontSize = fontSize;
  document.body.style.background = isDark ? "#171717" : "#F6F3EE";
  root?.setAttribute("data-muselink-mode", settings.mode);
  window.dispatchEvent(new CustomEvent("muselink-settings-change", { detail: settings }));
}

const ToggleRow = ({
  icon: Icon,
  title,
  body,
  checked,
  onChange,
}: {
  icon: typeof Lightbulb;
  title: string;
  body: string;
  checked: boolean;
  onChange: () => void;
}) => (
  <button
    type="button"
    onClick={onChange}
    className="flex w-full items-center justify-between gap-3 border-t border-gray-50 p-4 first:border-t-0"
  >
    <div className="flex min-w-0 items-start gap-3 text-left">
      <Icon size={18} className="mt-0.5 shrink-0 text-gray-400" />
      <div className="min-w-0">
        <p className="text-sm font-bold text-gray-800">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-gray-400">{body}</p>
      </div>
    </div>
    <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-primary" : "bg-gray-200")}>
      <span className={cn("absolute top-1 h-4 w-4 rounded-full bg-white transition-all", checked ? "right-1" : "left-1")} />
    </span>
  </button>
);

export const SettingsModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [settings, setSettings] = useState<GeneralSettings>(() => readSettings());
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    applySettings(settings);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    if (isOpen) {
      setSavedMessage("设置已保存");
      const timer = window.setTimeout(() => setSavedMessage(""), 1200);
      return () => window.clearTimeout(timer);
    }
  }, [settings, isOpen]);

  const updateSetting = <K extends keyof GeneralSettings>(key: K, value: GeneralSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    setSavedMessage("已恢复默认设置");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          className="fixed inset-0 z-[200] flex flex-col overflow-hidden bg-[var(--app-page-bg)]"
        >
          <div className="ios-title-bar flex shrink-0 items-center gap-3 border-b border-gray-100 bg-[var(--app-bar-bg)] px-4 backdrop-blur-xl">
            <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full text-gray-400 hover:bg-white">
              <ArrowLeft size={22} />
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-bold text-gray-950">通用设置</h2>
              <p className="mt-0.5 truncate text-[10px] text-gray-400">外观、阅读与图片显示偏好</p>
            </div>
            <button type="button" onClick={resetSettings} className="flex h-10 w-10 items-center justify-center rounded-full text-gray-400 hover:bg-white" title="恢复默认">
              <RotateCcw size={18} />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 no-scrollbar">
            <section className="space-y-2">
              <h3 className="px-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">外观模式</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "浅色模式", value: "light" as const, icon: Sun },
                  { label: "深色模式", value: "dark" as const, icon: Moon },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateSetting("mode", option.value)}
                    className={cn(
                      "ios-card flex items-center gap-3 border p-4 text-left transition-colors",
                      settings.mode === option.value ? "border-primary/40 bg-amber-50" : "border-gray-100 bg-white",
                    )}
                  >
                    <option.icon size={18} className="text-primary" />
                    <span className="min-w-0 flex-1 text-sm font-bold text-gray-800">{option.label}</span>
                    {settings.mode === option.value && <Check size={16} className="text-primary" />}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="px-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">主题色</h3>
              <div className="ios-card border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <Palette size={18} className="text-gray-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-800">选择强调色</p>
                    <p className="mt-1 text-xs text-gray-400">影响按钮、标签和关键状态色</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-3">
                  {themeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateSetting("themeColor", option.value)}
                      className="flex flex-col items-center gap-2"
                      title={option.label}
                    >
                      <span
                        className={cn("flex h-10 w-10 items-center justify-center rounded-full border-2", settings.themeColor === option.value ? "border-gray-900" : "border-white")}
                        style={{ backgroundColor: option.value }}
                      >
                        {settings.themeColor === option.value && <Check size={16} className="text-white" />}
                      </span>
                      <span className="text-[10px] font-bold text-gray-500">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="px-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">字体大小</h3>
              <div className="ios-card grid grid-cols-3 gap-2 border border-gray-100 bg-white p-2 shadow-sm">
                {fontSizeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateSetting("fontSize", option.value)}
                    className={cn(
                      "rounded-[5px] px-2 py-3 text-center transition-colors",
                      settings.fontSize === option.value ? "bg-primary text-white" : "bg-gray-50 text-gray-600",
                    )}
                  >
                    <Type size={16} className="mx-auto mb-1" />
                    <span className="block text-sm font-bold">{option.label}</span>
                    <span className="block text-[10px] opacity-75">{option.hint}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="px-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">体验偏好</h3>
              <div className="overflow-hidden rounded-[5px] border border-gray-100 bg-white shadow-sm">
                <ToggleRow
                  icon={Lightbulb}
                  title="显示新手提示"
                  body="保留引导提示、同步提醒和新功能说明"
                  checked={settings.showTips}
                  onChange={() => updateSetting("showTips", !settings.showTips)}
                />
                <ToggleRow
                  icon={Image}
                  title="开启图片占位 fallback"
                  body="图片缺失或加载失败时显示可读占位信息"
                  checked={settings.imageFallback}
                  onChange={() => updateSetting("imageFallback", !settings.imageFallback)}
                />
              </div>
            </section>

            <div className="rounded-[5px] border border-gray-100 bg-white p-4">
              <p className="text-xs leading-relaxed text-gray-500">
                当前设置保存在本机浏览器 localStorage。清理浏览器数据或更换设备后，需要重新设置。
              </p>
              {savedMessage && <p className="mt-2 text-xs font-bold text-primary">{savedMessage}</p>}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
