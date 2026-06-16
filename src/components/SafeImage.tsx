import React, { useState } from 'react';
import { isPlaceholderImage, getInitials, getAvatarColor } from '../utils';

interface SafeImageProps {
  src?: string;
  alt: string;
  className?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({ src, alt, className = "" }) => {
  const [hasError, setHasError] = useState(false);

  const initials = getInitials(alt);
  const bgClass = getAvatarColor(alt);

  if (src && !hasError && !isPlaceholderImage(src)) {
    return (
      <img
        src={src}
        alt={alt}
        className={`${className} object-cover`}
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <div className={`${className} ${bgClass} flex items-center justify-center text-white font-bold font-mono tracking-widest uppercase`}>
      {initials}
    </div>
  );
};
