import React from 'react';
import { cn } from '@/lib/utils';

const Logo = ({ className, textClassName, showText = true, size = "default" }) => {
  // Size variants for the icon wrapper
  const iconSizes = {
    sm: "w-8 h-8",
    default: "w-10 h-10", 
    lg: "w-16 h-16",
    xl: "w-24 h-24"
  };
  
  // Size variants for the text
  const textSizes = {
    sm: "text-xl",
    default: "text-2xl",
    lg: "text-4xl",
    xl: "text-5xl"
  };

  return (
    <div className={cn("flex items-center gap-2 select-none", className)}>
      <div className={cn("relative flex items-center justify-center transition-transform hover:scale-105", iconSizes[size] || iconSizes.default)}>
         <svg 
            viewBox="0 0 24 24" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full drop-shadow-sm"
         >
            <path 
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" 
            fill="url(#logo-gradient)" 
            />
            <defs>
            <linearGradient id="logo-gradient" x1="2" y1="3" x2="22" y2="21.35" gradientUnits="userSpaceOnUse">
                <stop stopColor="#f43f5e" /> 
                <stop offset="1" stopColor="#f97316" />
            </linearGradient>
            </defs>
        </svg>
      </div>
      
      {showText && (
        <span className={cn(
            "font-extrabold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-rose-500 to-orange-500", 
            textSizes[size] || textSizes.default, 
            textClassName
        )}>
          Singles
        </span>
      )}
    </div>
  );
};

export default Logo;