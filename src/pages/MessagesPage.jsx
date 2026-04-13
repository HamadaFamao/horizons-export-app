import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/supabaseClient';
import { fetchUserThreads, formatMessageTime } from '@/lib/messagingUtils';
import { ArrowLeft, MessageCircle, Loader2, Users, Pin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/AppHeader';
import { DEFAULT_AVATAR } from '@/lib/constants';
import { useUnread } from '@/context/UnreadContext';
import { useToast } from '@/components/ui/use-toast';

export default function MessagesPage() {
  const navigate = useNavigate();
  const { getThreadUnread } = useUnread();
  const { toast } = useToast();

  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState(null);
  const [doNotDisturb, setDoNotDisturb] = useState(false);
  const [togglingDND, setTogglingDND] = useState(false);

  // Agency pinned chat state
  const [agencyLoading, setAgencyLoading] = useState(true);
  const [agencyEnabled, setAgencyEnabled] = useState(false);
  const [agencyName, setAgencyName] = useState(null);

  useEffect(() => {
    const loadThreads = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          navigate('/auth');
          return;
        }

        setCurrentUser(user);

        const { data: profile } = await supabase
          .from('profiles')
          .select('do_not_disturb')
          .eq('id', user.id)
          .maybeSingle();
        setDoNotDisturb(!!profile?.do_not_disturb);

        const userThreads = await fetchUserThreads(user.id);
        setThreads(userThreads);
      } catch (err) {
        console.error('Error loading threads:', err);
        setError('Failed to load messages');
      } finally {
        setLoading(false);
      }
    };

    loadThreads();
  }, [navigate]);

  // Load agency membership / agent flag to decide pinned agency chat visibility
  useEffect(() => {
    const loadAgencyStatus = async () => {
      try {
        setAgencyLoading(true);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user?.id) {
          setAgencyEnabled(false);
          setAgencyName(null);
          return;
        }

        // 1) membership from v_user_agency (source of truth)
        let inAgency = false;
        let name = null;

        try {
          const { data: ua, error: uaErr } = await supabase
            .from('v_user_agency')
            .select('agency_id, agency_name')
            .eq('user_id', user.id)
            .maybeSingle();

          if (uaErr) {
            console.warn('[MessagesPage] v_user_agency error:', uaErr.message);
          } else if (ua?.agency_id) {
            inAgency = true;
            name = ua.agency_name || null;
          }
        } catch (e) {
          console.warn('[MessagesPage] v_user_agency fetch failed:', e?.message || e);
        }

        // 2) agent flag (agents should also see pinned entry)
        let isAgent = false;
        try {
          const { data: prof, error: profErr } = await supabase
            .from('profiles')
            .select('is_agent')
            .eq('id', user.id)
            .maybeSingle();

          if (profErr) {
            console.warn('[MessagesPage] profiles error:', profErr.message);
          } else if (prof?.is_agent === true) {
            isAgent = true;
          }
        } catch (e) {
          console.warn('[MessagesPage] profiles fetch failed:', e?.message || e);
        }

        const enabled = inAgency || isAgent;
        setAgencyEnabled(enabled);
        setAgencyName(name);
      } finally {
        setAgencyLoading(false);
      }
    };

    loadAgencyStatus();
  }, []);

  const handleThreadClick = (threadId) => {
    navigate(`/messages/${threadId}`);
  };

  const toggleDND = async () => {
    if (!currentUser?.id) return;
    setTogglingDND(true);
    try {
      const newDND = !doNotDisturb;
      const { error } = await supabase
        .from('profiles')
        .update({ do_not_disturb: newDND })
        .eq('id', currentUser.id);

      if (error) throw error;
      setDoNotDisturb(newDND);
      toast({
        title: newDND ? '🔕 Do Not Disturb ON' : '🔔 Do Not Disturb OFF',
        description: newDND
          ? 'No one can send you messages now'
          : 'You can receive messages again',
      });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setTogglingDND(false);
    }
  };

  const pinnedTitle = useMemo(() => {
    if (agencyName) return agencyName;
    return 'Agency Chat';
  }, [agencyName]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50 flex flex-col">
        <AppHeader />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-rose-500" />
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Messages - Singles</title>
      </Helmet>
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50 flex flex-col">
        <AppHeader />

        <div className="container mx-auto px-4 py-8 flex-1 flex flex-col max-w-3xl">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-pink-100 flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-pink-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="md:hidden">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <h1 className="text-2xl font-bold gradient-text">Messages</h1>
              </div>
              <button
                onClick={toggleDND}
                disabled={togglingDND}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition ${
                  doNotDisturb
                    ? 'bg-red-100 text-red-600 border border-red-200'
                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                }`}
              >
                {togglingDND
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : doNotDisturb ? '🔕 DND ON' : '🔔 DND OFF'
                }
              </button>
            </div>

            {/* Threads List */}
            <div className="flex-1 overflow-y-auto">
              {error ? (
                <div className="flex items-center justify-center h-full text-red-500">{error}</div>
              ) : (
                <>
                  {/* ✅ Pinned Agency Chat */}
                  {!agencyLoading && agencyEnabled && (
                    <div className="border-b border-pink-100 bg-white">
                      <div
                        onClick={() => navigate('/agency/chat')}
                        className="p-4 cursor-pointer transition-colors duration-200 hover:bg-rose-50"
                      >
                        <div className="flex gap-4 items-center">
                          {/* Avatar */}
                          <div className="relative">
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 border-2 border-white shadow-sm flex items-center justify-center">
                              <Users className="w-7 h-7 text-indigo-600" />
                            </div>
                            <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white h-5 w-5 flex items-center justify-center rounded-full border border-white">
                              <Pin className="w-3 h-3" />
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-1">
                              <h3 className="text-lg truncate pr-2 font-bold text-gray-900">
                                {pinnedTitle}
                                <span className="ml-2 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                                  Official
                                </span>
                              </h3>
                              <span className="text-xs text-gray-400 whitespace-nowrap mt-1">Pinned</span>
                            </div>

                            <p className="text-sm truncate text-gray-600">
                              Tap to open the official agency channel
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {threads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8 text-center">
                      <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-4">
                        <MessageCircle className="w-8 h-8 text-rose-500" />
                      </div>
                      <p className="text-lg font-semibold text-gray-700">No messages yet</p>
                      <p className="text-sm text-gray-500 max-w-xs mt-1">
                        Start a conversation by discovering people and messaging them!
                      </p>
                      <Button onClick={() => navigate('/')} className="mt-4 btn-gradient text-white">
                        Find Matches
                      </Button>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {threads.map((thread) => {
                        const unreadCount = getThreadUnread(thread.id);

                        let previewText = thread.lastMessage || '';
                        if (typeof previewText === 'string' && previewText.includes('SENT_GIFT_JSON:')) {
                          try {
                            const jsonStr = previewText.split('SENT_GIFT_JSON:')[1];
                            const parsed = JSON.parse(jsonStr);
                            const giftName = parsed.giftName || 'Gift';
                            previewText = `🎁 ${giftName}`;
                          } catch (e) {
                            previewText = '🎁 Gift';
                          }
                          console.log('[INBOX_GIFT_PREVIEW]', previewText);
                        }

                        return (
                          <div
                            key={thread.id}
                            onClick={() => handleThreadClick(thread.id)}
                            className={`p-4 cursor-pointer transition-colors duration-200 ${unreadCount > 0 ? 'bg-rose-50/60' : 'hover:bg-rose-50'
                              }`}
                          >
                            <div className="flex gap-4 items-center">
                              {/* Avatar */}
                              <div className="relative">
                                <img
                                  src={thread.otherUserProfile?.avatar_url || DEFAULT_AVATAR}
                                  alt={thread.otherUserProfile?.name || 'User'}
                                  className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm"
                                  onError={(e) => {
                                    e.target.src = DEFAULT_AVATAR;
                                  }}
                                />
                                {unreadCount > 0 && (
                                  <div className="absolute -top-1 -right-1 bg-rose-500 text-white text-xs font-bold h-5 w-5 flex items-center justify-center rounded-full border border-white">
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                  </div>
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-1">
                                  <h3
                                    className={`text-lg truncate pr-2 ${unreadCount > 0 ? 'font-bold text-gray-900' : 'font-semibold text-gray-900'
                                      }`}
                                  >
                                    {thread.otherUserProfile?.name || 'Unknown User'}
                                    {thread.otherUserProfile?.age && (
                                      <span className="text-sm font-normal text-gray-500 ml-2">
                                        {thread.otherUserProfile.age}
                                      </span>
                                    )}
                                  </h3>
                                  <span className="text-xs text-gray-400 whitespace-nowrap mt-1">
                                    {formatMessageTime(thread.lastMessageTime)}
                                  </span>
                                </div>

                                <p
                                  className={`text-sm truncate ${unreadCount > 0 || thread.lastMessageSenderId === currentUser?.id
                                    ? 'text-gray-700 font-medium'
                                    : 'text-gray-500'
                                    }`}
                                >
                                  {thread.lastMessageSenderId === currentUser?.id ? 'You: ' : ''}
                                  {previewText}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}