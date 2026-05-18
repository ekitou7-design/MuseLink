import React, { useEffect, useState } from "react";
import { Library } from "lucide-react";
import { cn } from "../lib/utils";
import { displayDbString, isStrictDbEmpty } from "../lib/dbDisplay";

export type SafeImageProps = React.ImgHTMLAttributes<HTMLImageElement>;

export function SafeImage({ src, alt, className, ...props }: SafeImageProps) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const rawSrc = typeof src === "string" ? src : src == null ? "" : String(src);

  useEffect(() => {
    setError(false);
    setLoading(true);
  }, [rawSrc]);

  if (isStrictDbEmpty(rawSrc) || error) {
    return (
      <div className={cn("flex flex-col items-center justify-center bg-gray-100 p-4 text-center", className)}>
        <Library className="mb-1 text-gray-300" size={24} />
        {isStrictDbEmpty(rawSrc) ? (
          <span className="text-[10px] text-gray-500">{displayDbString(rawSrc)}</span>
        ) : (
          <span className="break-all whitespace-pre-wrap text-left text-[10px] text-gray-600">{rawSrc}</span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {loading && (
        <div className="absolute inset-0 flex animate-pulse items-center justify-center bg-gray-100">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        </div>
      )}
      <img
        src={rawSrc}
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
}
