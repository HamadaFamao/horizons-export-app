import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Ban, Unlock } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const BlockButton = ({ targetUserId, isBlocked, onBlockChange }) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleToggleBlock = async () => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (isBlocked) {
        // Unblock
        const { error: deleteError } = await supabase
          .from('blocks')
          .delete()
          .eq('blocked', targetUserId)
          .eq('blocker', user.id);

        if (deleteError) throw deleteError;
        onBlockChange(false);
        toast({ title: "User Unblocked", description: "You can now interact with this user again." });
      } else {
        // Block
        const { error: insertError } = await supabase
          .from('blocks')
          .insert({
            blocker: user.id,
            blocked: targetUserId,
          });

        if (insertError) throw insertError;
        onBlockChange(true);
        toast({ title: "User Blocked", description: "You will no longer see this user.", variant: "destructive" });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to update block status", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={isBlocked ? "secondary" : "destructive"}
      size="sm"
      onClick={handleToggleBlock}
      disabled={loading}
      className="flex items-center gap-2"
    >
      {loading ? (
         <span>Loading...</span>
      ) : isBlocked ? (
        <>
          <Unlock className="w-4 h-4" /> Unblock
        </>
      ) : (
        <>
          <Ban className="w-4 h-4" /> Block
        </>
      )}
    </Button>
  );
};

export default BlockButton;