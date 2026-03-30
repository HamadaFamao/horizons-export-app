import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { LogOut } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function LeaveAgencyCard({ referredBy, onLeaveSuccess, isAgent }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [agent, setAgent] = useState(null);
  const [agentLoading, setAgentLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Fetch agent/family manager info on mount
  React.useEffect(() => {
    const fetchAgent = async () => {
      try {
        setAgentLoading(true);
        const { data, error } = await supabase.rpc('get_my_agent');

        if (error) {
          console.error('Error fetching agent:', error);
          setAgent(null);
          return;
        }

        if (data && data.length > 0) {
          setAgent(data[0]);
        }
      } catch (error) {
        console.error('Error fetching agent:', error);
        setAgent(null);
      } finally {
        setAgentLoading(false);
      }
    };

    if (referredBy) {
      fetchAgent();
    } else {
      setAgentLoading(false);
    }
  }, [referredBy]);

  const handleLeaveAgency = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase.rpc('leave_agency');

      if (error) {
        console.error('Error leaving agency:', error);
        toast({
          title: 'Error',
          description: 'Failed to leave family. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      if (data?.success) {
        onLeaveSuccess();
        setShowConfirm(false);
        toast({
          title: 'Success',
          description: 'You left the family.',
        });
      }
    } catch (error) {
      console.error('Error leaving agency:', error);
      toast({
        title: 'Error',
        description: 'Failed to leave family. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Only show if user is currently in a family (referred_by exists in current schema)
  if (!referredBy) return null;

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-[200px]">
            <div className="p-2 bg-blue-50 rounded-lg">
              <LogOut size={20} className="text-blue-600" />
            </div>

            <div className="flex-1">
              {/* ✅ Replace Agency → Family */}
              <h3 className="text-sm font-semibold text-gray-900">Family</h3>
              <p className="text-sm text-gray-600 mt-1">
                You are currently in a family.
              </p>

              {/* ❌ Remove showing legacy referral code completely */}
              {/* {referredBy && (
                <p className="text-xs text-gray-500 mt-1">
                  Code: <span className="font-mono font-semibold">{referredBy}</span>
                </p>
              )} */}

              {!agentLoading && agent && (
                <p className="text-xs text-gray-600 mt-2">
                  Family manager:{' '}
                  <span className="font-medium">
                    {agent.agent_name || `Manager ID: ${agent.agent_profile_id}`}
                  </span>
                  {agent.agent_name && (
                    <span className="text-gray-500"> (ID: {agent.agent_profile_id})</span>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowConfirm(true)}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {loading ? 'Leaving...' : 'Leave family'}
            </button>
          </div>
        </div>
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Family?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave the family? You will no longer receive rewards from this family, but your past earnings will remain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveAgency}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {loading ? 'Leaving...' : 'Leave Family'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}