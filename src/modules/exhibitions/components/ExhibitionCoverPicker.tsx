import { ChangeEvent, useRef, useState } from "react";
import { ImagePlus, Link, Upload } from "lucide-react";
import { SafeImage } from "../../../components/SafeImage";
import { cn } from "../../../lib/utils";
import { uploadExhibitionCover } from "../services/exhibitionsService";
import { DEFAULT_EXHIBITION_COVERS } from "../constants/covers";

export function ExhibitionCoverPicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (nextCoverUrl: string) => void;
  className?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsUploading(true);
    setUploadError("");
    try {
      const result = await uploadExhibitionCover(file);
      onChange(result.coverUrl);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid grid-cols-[112px_1fr] gap-4">
        <div className="aspect-[3/4] overflow-hidden rounded-2xl border border-gray-100 bg-gray-100 shadow-sm">
          <SafeImage src={value} className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 space-y-3">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              <ImagePlus size={13} />
              默认封面
            </div>
            <div className="grid grid-cols-5 gap-2">
              {DEFAULT_EXHIBITION_COVERS.map((coverUrl, index) => {
                const isSelected = value === coverUrl;
                return (
                  <button
                    key={coverUrl}
                    type="button"
                    aria-label={`选择默认封面 ${index + 1}`}
                    onClick={() => onChange(coverUrl)}
                    className={cn(
                      "aspect-[3/4] overflow-hidden rounded-xl border bg-gray-50 transition-all",
                      isSelected ? "border-primary ring-2 ring-primary/20" : "border-gray-100 hover:border-primary/50",
                    )}
                  >
                    <SafeImage src={coverUrl} className="h-full w-full object-cover" />
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white transition-all disabled:opacity-50"
          >
            <Upload size={14} />
            {isUploading ? "上传中..." : "本地上传图片"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
          <Link size={13} />
          封面 URL
        </label>
        <input
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder="可填写图片链接，或选择默认图/本地上传"
          className="w-full rounded-xl border border-gray-100 bg-white px-3 py-2 text-xs outline-none focus:border-primary"
        />
        {uploadError && <p className="text-[10px] font-bold text-rose-500">{uploadError}</p>}
      </div>
    </div>
  );
}
