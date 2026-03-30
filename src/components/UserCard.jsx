import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { getOnlineStatus } from '@/lib/lastSeenUtils';
import { DEFAULT_AVATAR } from '@/lib/constants';
import { getVipInfo } from '@/utils/vip';

export default function UserCard({ profile }) {
  const status = getOnlineStatus(profile);
  // Detect VIP status
  const vipInfo = getVipInfo(profile);
  const isVip = vipInfo.isVip;

  return (
    <Link to={`/user/${profile.profile_id}`}>
        <motion.div
            className="relative aspect-[3/4] overflow-hidden rounded-2xl shadow-lg group bg-white"
            whileHover={{ scale: 1.03, transition: { duration: 0.2 } }}
        >
            <div className={`relative w-full h-full ${isVip ? 'p-1' : ''}`}>
                {isVip && (
                    <div className="absolute inset-0 border-4 border-yellow-400 rounded-xl z-10 pointer-events-none opacity-80" />
                )}
                
                <img
                    src={profile.avatar_url || DEFAULT_AVATAR}
                    onError={(e) => { e.target.src = DEFAULT_AVATAR; }}
                    alt={profile.name}
                    className="w-full h-full object-cover bg-gray-200 rounded-xl"
                />
            </div>

            {/* VIP Badge - Top Right */}
            {isVip && (
                <div className="absolute top-3 right-3 z-20 bg-yellow-400 text-yellow-900 rounded-full px-2 py-0.5 text-xs font-bold flex items-center gap-1 shadow-md">
                    <span>{vipInfo.label}</span>
                    <span>👑</span>
                </div>
            )}

            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent z-20">
                <h3 className="text-white text-lg sm:text-xl font-bold flex items-center gap-1">
                    {profile.name}{profile.age ? `, ${profile.age}`: ''}
                    {profile.verified && <Star className="w-4 h-4 text-blue-400 fill-current" />}
                    {isVip && <span className="text-sm ml-1" title="VIP User">👑</span>}
                </h3>
                
                {/* Online Status */}
                <div className="flex items-center gap-1.5 text-xs mt-1">
                     <div
                        className={`w-2 h-2 rounded-full ${
                        status.isOnline ? 'bg-green-500 border border-white' : 'bg-gray-400'
                        }`}
                    />
                    <span
                        className={`${
                        status.isOnline
                            ? 'text-green-400 font-semibold'
                            : 'text-gray-300'
                        }`}
                    >
                        {status.isOnline ? 'Online' : status.text}
                    </span>
                </div>
            </div>
        </motion.div>
    </Link>
  );
}