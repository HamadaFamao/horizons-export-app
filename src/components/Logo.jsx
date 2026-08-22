import React from 'react';
import { cn } from '@/lib/utils';

const Logo = ({ className, textClassName, showText = true, size = "default" }) => {
  // Size variants for the icon wrapper (used when showText is false)
  // Scaled to ~2.5x the original icon dimensions (w-8/10/16/24 -> below)
  const iconSizes = {
    sm: "w-20 h-20",
    default: "w-[6.25rem] h-[6.25rem]",
    lg: "w-40 h-40",
    xl: "w-60 h-60"
  };

  // Size variants for the full lockup (icon + wordmark) when showText is true
  // Scaled to ~2.5x the original height (h-8/10/16/24 -> below); width follows
  // automatically via w-auto so the source aspect ratio is preserved.
  const primarySizes = {
    sm: "h-20",
    default: "h-[6.25rem]",
    lg: "h-40",
    xl: "h-60"
  };

  if (!showText) {
    return (
      <div className={cn("flex items-center select-none", className)}>
        <img
          src="/branding/logo-mark.png"
          alt="Famo"
          className={cn(
            "w-auto object-contain drop-shadow-sm transition-transform hover:scale-105",
            iconSizes[size] || iconSizes.default,
            textClassName
          )}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center select-none", className)}>
      <img
        src="/branding/logo-primary.png"
        alt="Famo"
        className={cn(
          "w-auto object-contain drop-shadow-sm transition-transform hover:scale-105",
          primarySizes[size] || primarySizes.default,
          textClassName
        )}
      />
    </div>
  );
};

export default Logo;
