import { motion } from 'motion/react';
import type { Artifact } from '../../../types';
import { SafeImage } from '../../../components/SafeImage';
import {
  artifactImageUrlRaw,
  artifactMuseumRaw,
  artifactNameRaw,
  displayDbString,
} from '../../../lib/dbDisplay';

export const ArtifactCard = ({ artifact, onClick }: { artifact: Artifact, onClick: () => void }) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={onClick}
      className="ios-card mb-3 cursor-pointer overflow-hidden break-inside-avoid group"
    >
      <SafeImage 
        src={String(artifactImageUrlRaw(artifact) ?? '')} 
        alt={typeof artifactNameRaw(artifact) === 'string' ? (artifactNameRaw(artifact) as string) : ''} 
        className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div className="space-y-1 p-3">
        <h3 className="min-w-0 break-words text-[13px] font-black leading-snug text-gray-950">{displayDbString(artifactNameRaw(artifact))}</h3>
        <p className="min-w-0 break-words text-[11px] leading-snug text-gray-500">{displayDbString(artifactMuseumRaw(artifact))}</p>
      </div>
    </motion.div>
  );
};
