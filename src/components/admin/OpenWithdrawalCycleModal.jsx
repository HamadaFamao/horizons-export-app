import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/use-toast';
import { useDebounce } from '@/hooks/useDebounce';
import { format } from 'date-fns';

export default function OpenWithdrawalCycleModal({ isOpen, onClose, onRefresh }) {
  const { toast } = useToast();
  
  // State
  const [selectedAgency, setSelectedAgency] = useState(null);
  const [note, setNote] = useState('');
  const [deadline, setDeadline] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const debouncedSearch = useDebounce(searchQuery, 500);

  // 1. Calculate current month date as first day of current month in DATE format (YYYY-MM-DD)
  const today = new Date();
  const cycleMonthDate = new Date(today.getFullYear(), today.getMonth(), 1);
  const cycleMonthString = format(cycleMonthDate, 'yyyy-MM-dd'); // e.g., "2024-01-01"

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setNote('');
      setDeadline('');
      setSelectedAgency(null);
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [isOpen]);

  // Handle Search
  useEffect(() => {
    const searchAgencies = async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) {
        setSearchResults([]);
        return;
      }
      
      setIsSearching(true);
      try {
        const { data, error } = await supabase.rpc('admin_search_agencies', {
          p_query: debouncedSearch
        });
        
        if (error) throw error;
        setSearchResults(data || []);
      } catch (err) {
        console.error("Agency search failed", err);
      } finally {
        setIsSearching(false);
      }
    };
    
    searchAgencies();
  }, [debouncedSearch]);

  const handleSubmit = async () => {
    // Validation before RPC call
    if (!selectedAgency || !selectedAgency.id) {
        toast({
            title: "Validation Error",
            description: "Please select an agency first.",
            variant: "destructive"
        });
        return;
    }

    if (!cycleMonthString) {
        toast({
            title: "Validation Error",
            description: "Cycle month is invalid.",
            variant: "destructive"
        });
        return;
    }
    
    setIsSubmitting(true);
    try {
      const rpcParams = { 
        p_agency_user_id: selectedAgency.id,
        p_note: note.trim() || null,
        p_deadline: deadline ? new Date(deadline).toISOString() : null
      };

      console.log("Opening cycle with open_agency_cycle_for:", rpcParams);

      const { data, error } = await supabase.rpc('open_agency_cycle_for', rpcParams);

      if (error) throw error;
      
      // Check logical error in data response if RPC returns object with success: false
      if (data && data.success === false) {
          throw new Error(data.error || "Failed to open cycle");
      }

      // Success handling
      toast({
        title: "Cycle Opened Successfully",
        description: `Locked ${data.locked_total_gems?.toLocaleString() || '0'} gems for ${selectedAgency.name} for ${format(cycleMonthDate, 'MMMM yyyy')}.`,
        className: "bg-green-50 border-green-200 text-green-800"
      });
      
      onRefresh();
      onClose();
      
    } catch (err) {
      console.error('Cycle open error:', err);
      let errorMsg = err.message || "An unexpected error occurred";
      
      // Error Handling logic
      if (errorMsg.includes('cycle_already_exists') || errorMsg.includes('cycle_already_open')) {
          errorMsg = `A withdrawal cycle is already open for ${selectedAgency.name} for this month (${format(cycleMonthDate, 'MMMM yyyy')}).`;
      } else if (errorMsg.includes('no_gems_to_collect')) {
          errorMsg = "Agency has 0 gems available to withdraw.";
      }
      
      toast({
        title: "Failed to Open Cycle",
        description: errorMsg,
        variant: "destructive"
      });
      
      // Refresh list even on error (e.g. to show the existing cycle if that was the issue)
      onRefresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Open Withdrawal Cycle</DialogTitle>
          <DialogDescription>
             Manually open a withdrawal cycle for an agency. This will lock current earnings and allow payout processing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
            {/* Cycle Month Info (Read Only) */}
            <div className="space-y-2">
                <Label>Cycle Month</Label>
                <div className="p-2 bg-gray-50 border rounded-md text-sm font-medium text-gray-700 flex justify-between items-center">
                    <span>{format(cycleMonthDate, 'MMMM yyyy')}</span>
                    <span className="text-xs text-gray-400 font-mono">{cycleMonthString}</span>
                </div>
                <p className="text-[10px] text-gray-400">
                    Current month - database will determine the actual cycle.
                </p>
            </div>

            {/* Agency Selection */}
            <div className="space-y-2">
                <Label>Select Agency</Label>
                {!selectedAgency ? (
                    <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search by name, ID or code..." 
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            disabled={isSubmitting}
                        />
                        {isSearching && (
                            <div className="absolute right-3 top-3">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                        )}
                        
                        {/* Dropdown Results */}
                        {searchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
                                {searchResults.map(agency => (
                                    <div 
                                        key={agency.id}
                                        className="p-2 hover:bg-gray-100 cursor-pointer flex items-center gap-3 transition-colors"
                                        onClick={() => {
                                            setSelectedAgency(agency);
                                            setSearchResults([]);
                                        }}
                                    >
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={agency.avatar_url} />
                                            <AvatarFallback>{agency.name?.charAt(0) || 'A'}</AvatarFallback>
                                        </Avatar>
                                        <div className="text-sm">
                                            <p className="font-medium text-gray-900">{agency.name}</p>
                                            <p className="text-xs text-gray-500">ID: {agency.profile_id} | Ref: {agency.referral_code}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center justify-between p-3 border rounded-md bg-indigo-50 border-indigo-100">
                         <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border border-indigo-200">
                                <AvatarImage src={selectedAgency.avatar_url} />
                                <AvatarFallback>{selectedAgency.name?.charAt(0) || 'A'}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-semibold text-indigo-900">{selectedAgency.name}</p>
                                <p className="text-xs text-indigo-600">ID: {selectedAgency.profile_id}</p>
                            </div>
                         </div>
                         <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-xs h-6 text-indigo-500 hover:text-indigo-700"
                            onClick={() => {
                                setSelectedAgency(null);
                                setSearchQuery('');
                            }}
                            disabled={isSubmitting}
                         >
                            Change
                         </Button>
                    </div>
                )}
            </div>

            {/* Admin Note */}
            <div className="space-y-2">
                <Label htmlFor="note">Admin Note (Optional)</Label>
                <Textarea 
                    id="note" 
                    placeholder="Any specific notes for this cycle..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={isSubmitting}
                />
            </div>

            {/* Deadline */}
            <div className="space-y-2">
                <Label htmlFor="deadline">
                  Withdrawal Deadline 
                  <span className="text-xs text-gray-400 ml-1">(Optional)</span>
                </Label>
                <Input
                  id="deadline"
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  disabled={isSubmitting}
                  min={new Date().toISOString().slice(0, 16)}
                />
                <p className="text-[10px] text-gray-400">
                  Set a deadline for agents to submit withdrawal requests.
                </p>
            </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!selectedAgency || isSubmitting}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {isSubmitting ? (
              <>
                 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                 Opening...
              </>
            ) : (
              'Confirm Open Cycle'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}