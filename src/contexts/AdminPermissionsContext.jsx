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
        const { data, error } = await supabase
          .from('v_staff_users')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (error || !data) {
          // fallback للنظام القديم
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

        setStaffRole(data.staff_role);
        setPermissions({
          can_manage_agencies:    data.can_manage_agencies,
          can_manage_withdrawals: data.can_manage_withdrawals,
          can_manage_rooms:       data.can_manage_rooms,
          can_manage_users:       data.can_manage_users,
          can_manage_banners:     data.can_manage_banners,
          can_send_notifications: data.can_send_notifications,
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

  return (
    <AdminPermissionsContext.Provider value={{ permissions, staffRole, loading, can, isAdmin }}>
      {children}
    </AdminPermissionsContext.Provider>
  );
}

export function useAdminPermissions() {
  return useContext(AdminPermissionsContext);
}