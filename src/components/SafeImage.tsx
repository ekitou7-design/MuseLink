import React, { useEffect, useState } from "react";
import { Library } from "lucide-react";
import { cn } from "../lib/utils";
import { displayDbString, isStrictDbEmpty } from "../lib/dbDisplay";

export type SafeImageProps = React.ImgHTMLAttributes<HTMLImageElement>;

function readImageFallbackEnabled() {
  try {
    const parsed = JSON.parse(localStorage.getItem("muselink_general_settings") || "{}");
    return parsed.imageFallback !== false;
  } catch {
    return true;
  }
}

export function SafeImage({ src, alt, className, ...props }: SafeImageProps) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [imageFallbackEnabled, setImageFallbackEnabled] = useState(readImageFallbackEnabled);

  const rawSrc = typeof src === "string" ? src : src == null ? "" : String(src);

  useEffect(() => {
    setError(false);
    setLoading(true);
  }, [rawSrc]);

  useEffect(() => {
    const handleSettingsChange = () => setImageFallbackEnabled(readImageFallbackEnabled());
    window.addEventListener("muselink-settings-change", handleSettingsChange);
    window.addEventListener("storage", handleSettingsChange);
    return () => {
      window.removeEventListener("muselink-settings-change", handleSettingsChange);
      window.removeEventListener("storage", handleSettingsChange);
    };
  }, []);

  if (isStrictDbEmpty(rawSrc) || error) {
    if (!imageFallbackEnabled) {
      return <div className={cn("bg-transparent", className)} aria-label={alt || "图片不可用"} />;
    }

    return (
      <div className={cn("flex flex-col items-center justify-center bg-[#F4F2EE] p-4 text-center", className)}>
        <Library className="mb-1 text-gray-300" size={24} />
        <span className="text-[10px] text-gray-500">{isStrictDbEmpty(rawSrc) ? displayDbString(rawSrc) : "图片暂不可用"}</span>
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {loading && (
        <div className="absolute inset-0 flex animate-pulse items-center justify-center bg-[#F4F2EE]">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        </div>
      )}
      <img
        src={rawSrc}
        alt={alt}
        loading={props.loading ?? "lazy"}
        decoding={props.decoding ?? "async"}
        width={props.width ?? 640}
        height={props.height ?? 480}
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
}
