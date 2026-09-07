import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const AdminPermissionsContext = createContext(null);

export function AdminPermissionsProvider({ children }) {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState(null);
  const [staffRole, setStaffRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setPermissions(null);
      setStaffRole(null);
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      setLoading(true);
      try {
        // First try: v_staff_users view
        const { data, error } = await supabase
          .from('v_staff_users')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (error || !data) {
          // Second try: staff_user_permissions table directly
          const { data: staffPerms } = await supabase
            .from('staff_user_permissions')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

          if (staffPerms) {
            setStaffRole('staff');
            setPermissions({
              can_manage_agencies: staffPerms.can_manage_agencies ?? false,
              can_manage_withdrawals: staffPerms.can_manage_withdrawals ?? false,
              can_manage_rooms: staffPerms.can_manage_rooms ?? false,
              can_manage_users: staffPerms.can_manage_users ?? false,
              can_manage_banners: staffPerms.can_manage_banners ?? false,
              can_send_notifications: staffPerms.can_send_notifications ?? false,
              can_manage_notifications: staffPerms.can_manage_notifications ?? false,
              can_manage_finance: staffPerms.can_manage_finance ?? false,
              can_manage_gifts: staffPerms.can_manage_gifts ?? false,
              can_manage_rewards: staffPerms.can_manage_rewards ?? false,
              can_manage_plans: staffPerms.can_manage_plans ?? false,
              can_manage_coins: staffPerms.can_manage_coins ?? false,
              can_manage_reports: staffPerms.can_manage_reports ?? false,
              can_manage_settings: staffPerms.can_manage_settings ?? false,
              can_manage_seed: staffPerms.can_manage_seed ?? false,
              can_manage_tools: staffPerms.can_manage_tools ?? false,
              can_manage_staff: staffPerms.can_manage_staff ?? false,
            });
            return;
          }

          // Third try: fallback للنظام القديم (profiles table)
          const { data: profile } = await supabase
            .from('profiles')
            .select('isadmin, admin_role')
            .eq('id', user.id)
            .maybeSingle();

          if (profile?.isadmin) {
            setStaffRole('manager');
            setPermissions({
              can_manage_agencies: true,
              can_manage_withdrawals: true,
              can_manage_rooms: true,
              can_manage_users: true,
              can_manage_banners: true,
              can_send_notifications: true,
              can_manage_notifications: true,
              can_manage_finance: true,
              can_manage_gifts: true,
              can_manage_rewards: true,
              can_manage_plans: true,
              can_manage_coins: true,
              can_manage_reports: true,
              can_manage_settings: true,
              can_manage_seed: true,
              can_manage_tools: true,
              can_manage_staff: true,
            });
          } else {
            setPermissions(null);
            setStaffRole(null);
          }
          return;
        }

        // v_staff_users worked, use its data
        setStaffRole(data.staff_role);
        setPermissions({
          can_manage_agencies:    data.can_manage_agencies,
          can_manage_withdrawals: data.can_manage_withdrawals,
          can_manage_rooms:       data.can_manage_rooms,
          can_manage_users:       data.can_manage_users,
          can_manage_banners:     data.can_manage_banners,
          can_send_notifications: data.can_send_notifications,
          can_manage_notifications: data.can_manage_notifications ?? data.can_send_notifications,
          can_manage_finance:     data.can_manage_finance,
          can_manage_gifts:       data.can_manage_gifts,
          can_manage_rewards:     data.can_manage_rewards,
          can_manage_plans:       data.can_manage_plans,
          can_manage_coins:       data.can_manage_coins,
          can_manage_reports:     data.can_manage_reports,
          can_manage_settings:    data.can_manage_settings,
          can_manage_seed:        data.can_manage_seed,
          can_manage_tools:       data.can_manage_tools,
          can_manage_staff:       data.can_manage_staff,
        });
      } catch (e) {
        console.error('[AdminPermissions] fetch failed', e);
        setPermissions(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [user?.id]);

  const can = (permission) => {
    if (!permissions) return false;
    return !!permissions[`can_${permission}`];
  };

  const isAdmin = !!staffRole;
  const hasNotificationPermission = permissions?.can_manage_notifications || false;

  return (
    <AdminPermissionsContext.Provider value={{
      ...permissions,
      permissions,
      staffRole,
      loading,
      can,
      isAdmin,
      can_manage_notifications: hasNotificationPermission,
    }}>
      {children}
    </AdminPermissionsContext.Provider>
  );
}

export const useAdminPermissions = () => {
  return useContext(AdminPermissionsContext);
};