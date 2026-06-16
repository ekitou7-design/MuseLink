import React, { useEffect, useState } from "react";
import { Library } from "lucide-react";
import { cn } from "../lib/utils";
import { displayDbString, isStrictDbEmpty } from "../lib/dbDisplay";

export type SafeImageProps = React.ImgHTMLAttributes<HTMLImageElement>;
const IMAGE_LOAD_TIMEOUT_MS = 5000;

function readImageFallbackEnabled() {
  try {
    const parsed = JSON.parse(localStorage.getItem("muselink_general_settings") || "{}");
    return parsed.imageFallback !== false;
  } catch {
    return true;
  }
}

function withRetryParam(src: string, retryAttempt: number) {
  if (retryAttempt <= 0) return src;
  const separator = src.includes("?") ? "&" : "?";
  return `${src}${separator}ml_retry=${retryAttempt}`;
}

export function SafeImage({ src, alt, className, onLoad, onError, ...props }: SafeImageProps) {
  const [loading, setLoading] = useState(true);
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [imageFallbackEnabled, setImageFallbackEnabled] = useState(readImageFallbackEnabled);

  const rawSrc = typeof src === "string" ? src : src == null ? "" : String(src);
  const candidateSrcs = React.useMemo(() => {
    const candidates = [rawSrc];
    const thumbMatch = rawSrc.match(/^\/artifact-images\/thumbs\/(.+)-thumb\.jpg(?:\?.*)?$/);
    if (thumbMatch) candidates.push(`/artifact-images/${thumbMatch[1]}.jpg`);
    const fullMatch = rawSrc.match(/^\/artifact-images\/(.+)\.jpg(?:\?.*)?$/);
    if (fullMatch && !rawSrc.includes("/thumbs/")) candidates.push(`/artifact-images/thumbs/${fullMatch[1]}-thumb.jpg`);
    return Array.from(new Set(candidates.filter(Boolean)));
  }, [rawSrc]);
  const effectiveSrc = candidateSrcs[fallbackIndex] || rawSrc;
  const retrySrc = withRetryParam(effectiveSrc, retryAttempt);

  useEffect(() => {
    setLoading(true);
    setFallbackIndex(0);
    setRetryAttempt(0);
    setFailed(false);
  }, [rawSrc]);

  useEffect(() => {
    if (isStrictDbEmpty(rawSrc) || !loading || failed) return;
    const timer = window.setTimeout(() => {
      if (fallbackIndex + 1 < candidateSrcs.length) {
        setFallbackIndex((index) => index + 1);
        setLoading(true);
        return;
      }
      setLoading(false);
      setFailed(true);
    }, IMAGE_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [candidateSrcs.length, failed, fallbackIndex, loading, rawSrc]);

  useEffect(() => {
    const handleSettingsChange = () => setImageFallbackEnabled(readImageFallbackEnabled());
    window.addEventListener("muselink-settings-change", handleSettingsChange);
    window.addEventListener("storage", handleSettingsChange);
    return () => {
      window.removeEventListener("muselink-settings-change", handleSettingsChange);
      window.removeEventListener("storage", handleSettingsChange);
    };
  }, []);

  const fallbackContent = (
    <div className={cn("flex flex-col items-center justify-center bg-[#F4F2EE] p-4 text-center", className)}>
      <Library className="mb-1 text-gray-300" size={24} />
      <span className="text-[10px] text-gray-500">{displayDbString(rawSrc)}</span>
      {failed && (
        <button
          type="button"
          className="mt-2 rounded-full bg-white/80 px-2 py-1 text-[10px] font-bold text-gray-500 shadow-sm"
          onClick={(event) => {
            event.stopPropagation();
            setFailed(false);
            setLoading(true);
            setFallbackIndex(0);
            setRetryAttempt((attempt) => attempt + 1);
          }}
        >
          重试
        </button>
      )}
    </div>
  );

  if (isStrictDbEmpty(rawSrc) || failed) {
    if (!imageFallbackEnabled) {
      return <div className={cn("bg-transparent", className)} aria-label={alt || "图片不可用"} />;
    }

    return fallbackContent;
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {loading && (
        <div className="absolute inset-0 flex animate-pulse items-center justify-center bg-[#F4F2EE]">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        </div>
      )}
      <img
        key={`${effectiveSrc}-${retryAttempt}`}
        src={retrySrc}
        alt={alt}
        loading={props.loading ?? "lazy"}
        decoding={props.decoding ?? "async"}
        width={props.width ?? 640}
        height={props.height ?? 480}
        className={cn(className, loading ? "opacity-0" : "opacity-100 transition-opacity duration-300")}
        onLoad={(event) => {
          setLoading(false);
          setFailed(false);
          onLoad?.(event);
        }}
        onError={(event) => {
          onError?.(event);
          if (fallbackIndex + 1 < candidateSrcs.length) {
            setFallbackIndex((index) => index + 1);
            setLoading(true);
            return;
          }
          setLoading(false);
          setFailed(true);
        }}
        referrerPolicy="no-referrer"
        {...props}
      />
    </div>
  );
}
