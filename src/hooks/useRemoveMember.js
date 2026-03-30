import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';

export const useRemoveMember = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  const errorKeyMap = {
    'PENDING_WITHDRAWALS': 'This member has pending withdrawal requests and cannot be removed.',
    'ACTIVE_WITHDRAWAL_CYCLE': 'Cannot remove member during an active withdrawal cycle.',
    'CANNOT_REMOVE_SELF': 'You cannot remove yourself from the agency.',
    'NOT_IN_AGENCY': 'This user is not a member of your agency.',
    'AGENT_SUSPENDED': 'Your agency account is currently suspended.',
    'MEMBER_NOT_FOUND': 'The member could not be found.',
    'CANNOT_REMOVE_AN_AGENT': 'Cannot remove another agent from your agency.',
  };

  const removeMember = async (memberProfileId, reason) => {
    setLoading(true);
    setError(null);

    try {
      console.log(`[useRemoveMember] Attempting to remove member ${memberProfileId}`);

      const { data, error: rpcError } = await supabase.rpc('agent_remove_member_from_agency', {
        p_member_profile_id: memberProfileId,
        p_note: reason || null
      });

      if (rpcError) throw rpcError;

      // Check logical error in response based on function return structure
      // Function returns jsonb: { success: boolean, error?: string, message?: string }
      if (data && data.success === false) {
        const errorCode = data.error || 'UNKNOWN_ERROR';
        const errorMessage = errorKeyMap[errorCode] || (data.message || 'Failed to remove member. Please try again.');
        
        // Log failure
        console.warn(`[useRemoveMember] Removal failed: ${errorCode} - ${errorMessage}`);
        
        setError(errorMessage);
        toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive",
        });
        
        return { success: false, error: errorMessage };
      }

      // Success
      console.log(`[useRemoveMember] Successfully removed member ${memberProfileId}`);
      toast({
        title: "Success",
        description: "Member removed from your agency.",
        className: "bg-green-50 border-green-200 text-green-800",
      });

      return { success: true, data };

    } catch (err) {
      console.error('[useRemoveMember] Exception:', err);
      const msg = 'Failed to remove member. Please check your connection and try again.';
      setError(msg);
      toast({
        title: "Error",
        description: msg,
        variant: "destructive",
      });
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    removeMember
  };
};