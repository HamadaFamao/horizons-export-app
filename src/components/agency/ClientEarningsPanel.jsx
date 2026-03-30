import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Users, Search, Trash2, Diamond, RefreshCw, Calendar, ArrowRightLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { formatDistanceToNow, format, isAfter, subHours, parseISO } from 'date-fns';
import RemoveFromAgencyModal from './RemoveFromAgencyModal';
import { useRemoveMember } from '@/hooks/useRemoveMember';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DEFAULT_AVATAR } from '@/lib/constants';

const SafeMemberAvatar = ({ src, name, className }) => {
  return (
    <Avatar className={className}>
      <AvatarImage
        src={src || DEFAULT_AVATAR}
        alt={name}
        className="object-cover"
      />
      <AvatarFallback className="bg-indigo-50 text-indigo-600 text-xs font-bold">
        {name ? name.charAt(0).toUpperCase() : '?'}
      </AvatarFallback>
    </Avatar>
  );
};

export default function ClientEarningsPanel({ members, loading, onMemberRemoved }) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const { removeMember, loading: removeLoading } = useRemoveMember();

  const [selectedMember, setSelectedMember] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    // Debug فقط
    console.log('[ClientEarningsPanel] members:', members?.length || 0, members);
  }, [members]);

  const handleRemoveClick = (member, e) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedMember(member);
    setIsDialogOpen(true);
  };

  const handleConfirmRemoval = async (member, reason) => {
    if (!member) return;

    const removalId = member.profile_id;
    const result = await removeMember(removalId, reason);

    if (result?.success) {
      setIsDialogOpen(false);
      setSelectedMember(null);
      onMemberRemoved?.();
    }
  };

  const isActiveToday = (dateString) => {
    if (!dateString) return false;
    try {
      const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
      const twentyFourHoursAgo = subHours(new Date(), 24);
      return isAfter(date, twentyFourHoursAgo);
    } catch {
      return false;
    }
  };

  const filteredMembers = (members || []).filter(member => {
    const query = searchQuery.toLowerCase();
    const pid = (member.profile_id || '').toString();
    const name = member.name || member.display_name || '';
    return name.toLowerCase().includes(query) || pid.includes(query);
  });

  return (
    <>
      <Card className="bg-white shadow-sm border-gray-200">
        <CardHeader className="border-b bg-gray-50/50 pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                Agency Members
              </CardTitle>
              <CardDescription>
                Track gems earned by your members. Click on a member to view their profile.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Search by name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-[200px] h-9 bg-white"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onMemberRemoved?.()}
                disabled={loading}
                className="h-9 w-9"
                title="Refresh members"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-gray-500">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-indigo-500" />
              <p>Loading members list...</p>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Users className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p>{searchQuery ? "No matches found" : "No members found"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    <TableHead className="w-[250px]">Member</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        Gems (Month)
                        <Diamond className="w-3 h-3 text-emerald-500" />
                      </div>
                    </TableHead>
                    <TableHead className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        Conversions (Month)
                        <ArrowRightLeft className="w-3 h-3 text-blue-500" />
                      </div>
                    </TableHead>
                    <TableHead className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        Total Gems
                        <Diamond className="w-3 h-3 text-emerald-500" />
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Last Activity</TableHead>
                    <TableHead className="w-[90px]" />
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredMembers.map((member) => {
                    const isSelf = member.user_id === user?.id;
                    const isActive = isActiveToday(member.last_conversion_at);

                    const profileIdNumber = member.profile_id;
                    const displayName = member.name || 'Unknown';
                    const avatarUrl = member.avatar_url;

                    return (
                      <TableRow key={`${member.user_id || 'u'}-${profileIdNumber || 'p'}`} className="hover:bg-gray-50/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {profileIdNumber ? (
                              <a
                                href={`/user/${profileIdNumber}`}
                                className="member-link-item"
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`View profile of ${displayName}`}
                              >
                                <SafeMemberAvatar
                                  src={avatarUrl}
                                  name={displayName}
                                  className="h-9 w-9 border border-gray-100"
                                />
                              </a>
                            ) : (
                              <SafeMemberAvatar
                                src={avatarUrl}
                                name={displayName}
                                className="h-9 w-9 border border-gray-100"
                              />
                            )}

                            <div className="flex flex-col items-start gap-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-gray-900">{displayName}</span>
                                {isActive && (
                                  <Badge className="bg-emerald-100 text-emerald-700 border-0 px-1.5 py-0 h-4 text-[10px] font-medium whitespace-nowrap">
                                    Active Today
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-gray-500 font-mono">ID: {profileIdNumber || '—'}</span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="text-xs text-gray-500">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3 h-3 opacity-50" />
                            {member.joined_at ? format(new Date(member.joined_at), 'MMM d, yyyy') : '-'}
                          </div>
                        </TableCell>

                        <TableCell className="text-right font-medium text-emerald-600">
                          {(member.gems_this_month ?? 0).toLocaleString()}
                        </TableCell>

                        <TableCell className="text-right text-gray-600">
                          {(member.conversions_this_month ?? 0).toLocaleString()}
                        </TableCell>

                        <TableCell className="text-right text-emerald-700 font-semibold">
                          {(member.gems_total ?? 0).toLocaleString()}
                        </TableCell>

                        <TableCell className="text-right text-xs text-gray-500">
                          {member.last_conversion_at
                            ? formatDistanceToNow(new Date(member.last_conversion_at), { addSuffix: true })
                            : <span className="text-gray-300">No activity</span>}
                        </TableCell>

                        <TableCell className="text-right">
                          {!isSelf && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                              onClick={(e) => handleRemoveClick(member, e)}
                              title="Remove member"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <RemoveFromAgencyModal
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onConfirm={handleConfirmRemoval}
        member={selectedMember}
        isLoading={removeLoading}
      />
    </>
  );
}