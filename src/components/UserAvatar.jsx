import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DEFAULT_AVATAR } from '@/lib/constants';
import { cn } from '@/lib/utils';

export default function UserAvatar({ user, size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-14 w-14 text-base',
    xl: 'h-20 w-20 text-xl'
  };

  return (
    <Avatar className={cn(sizeClasses[size] || sizeClasses.md, "border border-gray-100 bg-gray-50", className)}>
      <AvatarImage 
        src={user?.avatar_url || DEFAULT_AVATAR} 
        alt={user?.name || 'User'}
        className="object-cover"
      />
      <AvatarFallback className="text-gray-500 font-medium">
        {user?.name?.charAt(0).toUpperCase() || 'U'}
      </AvatarFallback>
    </Avatar>
  );
}