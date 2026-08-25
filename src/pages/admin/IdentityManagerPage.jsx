import React from 'react';
import { useAdminPermissions } from '@/contexts/AdminPermissionsContext';
import { Card, CardContent } from '@/components/ui/card';
import { Fingerprint, ShieldAlert } from 'lucide-react';

export default function IdentityManagerPage() {
  const { permissions, loading: permLoading } = useAdminPermissions();
  const canAccess = !!permissions?.can_manage_users;

  if (!permLoading && !canAccess) {
    return (
      <div className="p-4 md:p-6">
        <h1 className="text-2xl font-bold mb-4">Identity Manager</h1>
        <Card className="border-t-4 border-t-red-500">
          <CardContent className="py-8">
            <div className="flex items-start gap-3 text-red-700">
              <ShieldAlert className="w-5 h-5 mt-0.5" />
              <div>
                <p className="font-semibold">No permission to view this page.</p>
                <p className="text-sm text-red-600 mt-1">You must have Manager permissions (Manage Users) to access Identity Manager.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Fingerprint className="w-6 h-6 text-rose-500" />
          Identity Manager
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage user login identities without migrating account data.
        </p>
      </div>

      <Card className="border-t-4 border-t-rose-500">
        <CardContent className="p-4 md:p-6">
          <p className="text-sm text-slate-400">Coming in next step...</p>
        </CardContent>
      </Card>
    </div>
  );
}
