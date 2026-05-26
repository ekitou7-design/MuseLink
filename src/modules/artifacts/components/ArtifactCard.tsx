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
      className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-100 cursor-pointer group break-inside-avoid mb-1.5"
    >
      <SafeImage 
        src={String(artifactImageUrlRaw(artifact) ?? '')} 
        alt={typeof artifactNameRaw(artifact) === 'string' ? (artifactNameRaw(artifact) as string) : ''} 
        className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div className="p-1.5 space-y-0.5">
        <h3 className="min-w-0 break-words font-serif font-bold text-[11px] text-gray-900">{displayDbString(artifactNameRaw(artifact))}</h3>
        <p className="min-w-0 break-words text-[9px] text-gray-400">{displayDbString(artifactMuseumRaw(artifact))}</p>
      </div>
    </motion.div>
  );
};
