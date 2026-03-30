
import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';

import AuthPage from '@/pages/AuthPage';
import AuthCallback from '@/pages/AuthCallback';
import UserProfilePage from '@/pages/UserProfilePage';
import ProfilePage from '@/pages/ProfilePage';
import ProfileEditPage from '@/pages/ProfileEditPage';
import DiscoverPage from '@/pages/DiscoverPage';
import MessagesPage from '@/pages/MessagesPage';
import ChatPage from '@/pages/ChatPage';
import MatchesPage from '@/pages/MatchesPage';
import SettingsPage from '@/pages/SettingsPage';
import PlansPage from '@/pages/PlansPage';
import WalletPage from '@/pages/WalletPage';
import WalletActivityPage from '@/pages/WalletActivityPage';

import AgencyEarningsPage from '@/pages/AgencyEarningsPage';
import AgencyMonthlyWithdrawal from '@/pages/agency/AgencyMonthlyWithdrawal';
import AgencyWithdrawal from '@/pages/agency/AgencyWithdrawal';
import AgentDashboard from '@/components/AgentDashboard';
import AgencyChatPage from '@/pages/AgencyChatPage';
import AgencyChatGate from '@/pages/AgencyChatGate';

import RechargeAgentPanel from '@/pages/RechargeAgentPanel';
import RechargeAgentPage from '@/pages/recharge/RechargeAgentPage';
import AgentWithdrawals from '@/pages/recharge-agent/AgentWithdrawals';

import SearchPage from '@/pages/SearchPage';
import InboxPage from '@/pages/InboxPage';
import BlockedUsersPage from '@/pages/BlockedUsersPage';
import RoomsLobby from '@/pages/RoomsLobby';
import LiveRoomPage from '@/pages/LiveRoomPage'; 

import AdminLayout from '@/pages/admin/AdminLayout';
import AdminOverview from '@/pages/admin/AdminOverview';
import AdminUsers from '@/pages/admin/AdminUsers';
import AdminAgencies from '@/pages/admin/AdminAgencies';
import AdminSeed from '@/pages/admin/AdminSeed';
import ProfileIdTool from '@/pages/admin/ProfileIdTool';
import AdminWithdrawals from '@/pages/admin/AdminWithdrawals';
import AdminGiftsPage from '@/pages/AdminGiftsPage'; // ✅ ADDED

import WebsiteLayout from '@/components/WebsiteLayout';
import AdminErrorBoundary from '@/components/AdminErrorBoundary';
import ProtectedRoute from '@/components/ProtectedRoute';
import MiniRoomBar from '@/components/MiniRoomBar';

import { useAuth } from '@/contexts/AuthContext';
import { CoinsProvider } from '@/contexts/CoinsContext';
import { RewardsProvider } from '@/contexts/RewardsContext';
import { UnreadProvider } from '@/context/UnreadContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { UnsavedChangesProvider } from '@/contexts/UnsavedChangesContext';

import { useUpdateLastSeen } from '@/hooks/useUpdateLastSeen';
import { usePageVisibility } from '@/hooks/usePageVisibility';
import { updateLastSeen } from '@/lib/lastSeenUtils';
import { fetchUserWallet } from '@/lib/walletUtils';

const isHorizonsPreview =
  typeof window !== 'undefined' &&
  (window.self !== window.top ||
    window.location.hostname.includes('horizons.hostinger.com'));

function HorizonsPreviewBlocked() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full bg-white border rounded-xl p-6 text-center shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Preview Disabled</h2>
        <p className="text-slate-600 mt-2 text-sm leading-relaxed">
          Hostinger Horizons preview runs inside an iframe, which can break Supabase auth
          and block publishing.
        </p>

        <div className="mt-4 text-sm">
          <div className="text-slate-700 font-medium">✅ Test the app from:</div>
          <div className="mt-1 font-mono text-xs bg-slate-100 rounded p-2">
            https://singlesdate.online
          </div>
        </div>

        <p className="text-xs text-slate-500 mt-4">
          You can still publish safely — this page is only for Horizons preview.
        </p>
      </div>
    </div>
  );
}

function AppContent() {
  useUpdateLastSeen();
  usePageVisibility();

  const { user } = useAuth();

  useEffect(() => {
    const initUser = async () => {
      if (user?.id) {
        try {
          updateLastSeen(user.id);
          fetchUserWallet(user.id);
        } catch (err) {
          console.error('Data sync error:', err);
        }
      }
    };

    if (user?.id) initUser();

    const interval = setInterval(() => {
      if (user?.id) updateLastSeen(user.id);
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user?.id]);

  return (
    <div className="min-h-screen flex flex-col relative">
      <MiniRoomBar />
      <Routes>
        {/* Website Layout */}
        <Route element={<WebsiteLayout />}>
          {/* Public Routes */}
          <Route path="/" element={<DiscoverPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Redirects */}
          <Route path="/discover" element={<Navigate to="/" replace />} />
          <Route path="/login" element={<Navigate to="/auth" replace />} />
          <Route path="/signup" element={<Navigate to="/auth" replace />} />
          <Route path="/landing" element={<Navigate to="/" replace />} />
          <Route path="/dashboard" element={<Navigate to="/profile" replace />} />
          <Route path="/home" element={<Navigate to="/" replace />} />

          {/* Semi-Protected / Public accessible */}
          <Route path="/plans" element={<PlansPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/user/:profileId" element={<UserProfilePage />} />

          {/* Protected Routes */}
          <Route
            path="/rooms"
            element={
              <ProtectedRoute>
                <RoomsLobby />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rooms/:roomId"
            element={
              <ProtectedRoute>
                <LiveRoomPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/edit"
            element={
              <ProtectedRoute>
                <ProfileEditPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/messages"
            element={
              <ProtectedRoute>
                <MessagesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/messages/:threadId"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/matches"
            element={
              <ProtectedRoute>
                <MatchesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/wallet"
            element={
              <ProtectedRoute>
                <WalletPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/wallet-activity"
            element={
              <ProtectedRoute>
                <WalletActivityPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/agency-earnings"
            element={
              <ProtectedRoute>
                <AgencyEarningsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/agency/dashboard"
            element={
              <ProtectedRoute>
                <AgentDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/agency/monthly-withdrawal"
            element={
              <ProtectedRoute>
                <AgencyMonthlyWithdrawal />
              </ProtectedRoute>
            }
          />
          <Route
            path="/agency/withdrawal"
            element={
              <ProtectedRoute>
                <AgencyWithdrawal />
              </ProtectedRoute>
            }
          />

          <Route
            path="/agency/chat"
            element={
              <ProtectedRoute>
                <AgencyChatGate />
              </ProtectedRoute>
            }
          />
          <Route path="/agency-chat" element={<Navigate to="/agency/chat" replace />} />

          <Route
            path="/agency-chat/:chatId"
            element={
              <ProtectedRoute>
                <AgencyChatPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/recharge-agent"
            element={
              <ProtectedRoute>
                <RechargeAgentPanel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/recharge-agent/buy"
            element={
              <ProtectedRoute>
                <RechargeAgentPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/recharge-agent/withdrawals"
            element={
              <ProtectedRoute>
                <AgentWithdrawals />
              </ProtectedRoute>
            }
          />

          <Route
            path="/inbox"
            element={
              <ProtectedRoute>
                <InboxPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/blocked"
            element={
              <ProtectedRoute>
                <BlockedUsersPage />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute adminOnly={true}>
              <AdminErrorBoundary>
                <AdminLayout />
              </AdminErrorBoundary>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" />} />
          <Route path="dashboard" element={<AdminOverview />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="agencies" element={<AdminAgencies />} />
          <Route path="seed" element={<AdminSeed />} />
          <Route path="tools/profile-id" element={<ProfileIdTool />} />
          <Route path="withdrawals" element={<AdminWithdrawals />} />
          <Route path="gifts" element={<AdminGiftsPage />} />  {/* ✅ ADDED */}
        </Route>
      </Routes>

      <Toaster />
    </div>
  );
}

function App() {
  if (isHorizonsPreview) {
    return <HorizonsPreviewBlocked />;
  }

  return (
    <CoinsProvider>
      <RewardsProvider>
        <UnreadProvider>
          <LanguageProvider>
            <UnsavedChangesProvider>
              <AppContent />
            </UnsavedChangesProvider>
          </LanguageProvider>
        </UnreadProvider>
      </RewardsProvider>
    </CoinsProvider>
  );
}

export default App;
