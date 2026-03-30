import React, { useEffect, useState, useRef } from 'react';
import { Building, Plus, Search, User, Loader2, X, Check, Copy, RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { logRedirect } from '@/lib/debugLogger';
import { useUnsavedChanges } from '@/contexts/UnsavedChangesContext';
import { saveDraft, loadDraft, clearDraft } from '@/lib/formDraftStorage';

const DRAFT_KEY = 'adminAgencies_draft';

const AdminAgencies = () => {
    const { toast } = useToast();
    const { setDirty } = useUnsavedChanges();
    
    // --- Create Form State ---
    const [isCreating, setIsCreating] = useState(false);
    const [agencyName, setAgencyName] = useState('');
    const [selectedOwner, setSelectedOwner] = useState(null);
    const [createdAgency, setCreatedAgency] = useState(null); // Stores success data
    
    // --- Unsaved Changes Detection ---
    // Form is dirty if fields have values AND we haven't successfully created an agency yet
    const isLocalDirty = (agencyName.trim() !== '' || selectedOwner !== null) && !createdAgency;

    // --- Search/Autocomplete State ---
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    
    const searchInputRef = useRef(null);
    const dropdownRef = useRef(null);
    
    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    // --- Agencies List State ---
    const [agencies, setAgencies] = useState([]);
    const [isLoadingAgencies, setIsLoadingAgencies] = useState(false);
    const [agenciesError, setAgenciesError] = useState(null);

    // --- Draft Persistence: Load on Mount ---
    useEffect(() => {
        const draft = loadDraft(DRAFT_KEY);
        if (draft) {
            // Restore fields if present in draft
            // Note: draft.selectedProfile maps to component state 'selectedOwner'
            if (draft.agencyName !== undefined) setAgencyName(draft.agencyName);
            if (draft.selectedProfile !== undefined) setSelectedOwner(draft.selectedProfile);
            if (draft.searchQuery !== undefined) setSearchQuery(draft.searchQuery);
            if (draft.searchResults !== undefined) setSearchResults(draft.searchResults);
        }
    }, []);

    // --- Draft Persistence: Save on Change ---
    useEffect(() => {
        // Persist draft unless we have successfully created an agency (which displays success view)
        // If createdAgency is true, the form inputs are hidden, so we shouldn't overwrite draft with stale state,
        // although technically state is preserved. More importantly, we clear draft on success, 
        // so we avoid re-saving it immediately here.
        if (!createdAgency) {
            saveDraft(DRAFT_KEY, {
                agencyName,
                selectedProfile: selectedOwner, // Map component state 'selectedOwner' to 'selectedProfile' in storage
                searchQuery,
                searchResults
            });
        }
    }, [agencyName, selectedOwner, searchQuery, searchResults, createdAgency]);

    // --- Sync Dirty State with Context ---
    useEffect(() => {
        setDirty(isLocalDirty);
    }, [isLocalDirty, setDirty]);

    // --- Cleanup on Unmount ---
    useEffect(() => {
        return () => setDirty(false);
    }, [setDirty]);
    
    // --- Browser Refresh/Close Protection ---
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (isLocalDirty) {
                // Log strictly for functional tracing of protection logic
                console.log('[UnsavedChanges] Browser unload prevented.');
                logRedirect('AdminAgencies: Browser Unload Prevented', 'EXTERNAL');
                e.preventDefault();
                e.returnValue = ''; // Chrome requires returnValue to be set
                return '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isLocalDirty]);

    useEffect(() => {
        // Removed unnecessary "Page loaded" debug log
        fetchAgencies();
    }, []);

    // --- Create Agency: Click Outside Dropdown ---
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target) && 
                searchInputRef.current && !searchInputRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // --- Create Agency: Search Effect ---
    useEffect(() => {
        const searchProfiles = async () => {
            if (!debouncedSearchQuery || debouncedSearchQuery.length < 2) {
                // Only clear results if we are actually interacting with search.
                // On mount, if we restored a query but debounce hasn't fired yet, this might run.
                // However, restoring searchQuery sets the state, so debouncedSearchQuery will update.
                // We avoid clearing restored results unnecessarily if the query is just empty.
                if (debouncedSearchQuery === '') {
                     setSearchResults([]);
                }
                return;
            }

            setIsSearching(true);
            setShowDropdown(true);
            
            try {
                // Call the admin_search_profiles RPC
                const { data, error } = await supabase
                    .rpc('admin_search_profiles', { 
                        p_q: debouncedSearchQuery,
                        p_limit: 10 
                    });

                if (error) throw error;
                
                setSearchResults(data || []);
            } catch (err) {
                console.error("Error searching profiles:", err);
                toast({
                    title: "Search Error",
                    description: "Failed to search profiles.",
                    variant: "destructive"
                });
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        };

        searchProfiles();
    }, [debouncedSearchQuery, toast]);

    // --- Agencies List: Fetch Function ---
    const fetchAgencies = async () => {
        setIsLoadingAgencies(true);
        setAgenciesError(null);

        try {
            const { data, error } = await supabase
                .from('agencies')
                .select(`
                    id,
                    name,
                    agency_code,
                    is_active,
                    created_at,
                    owner_user_id,
                    owner:profiles!owner_user_id (
                        profile_id,
                        name,
                        avatar_url
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            setAgencies(data || []);
        } catch (err) {
            console.error("Error fetching agencies:", err);
            setAgenciesError(err.message);
            toast({
                title: "Fetch Error",
                description: "Failed to load agencies list.",
                variant: "destructive"
            });
        } finally {
            setIsLoadingAgencies(false);
        }
    };

    // --- Create Agency Handlers ---
    const handleSelectProfile = (profile) => {
        setSelectedOwner(profile);
        setSearchQuery(''); // Clear search input
        setShowDropdown(false);
        setSearchResults([]);
    };

    const handleClearSelection = () => {
        setSelectedOwner(null);
        setSearchQuery('');
    };

    const handleCopyCode = () => {
        if (createdAgency?.agency_code) {
            navigator.clipboard.writeText(createdAgency.agency_code);
            toast({
                title: "Copied!",
                description: "Agency code copied to clipboard",
                className: "bg-green-50 border-green-200 text-green-800"
            });
        }
    };

    const handleResetForm = () => {
        clearDraft(DRAFT_KEY); // Clear persisted draft
        setCreatedAgency(null);
        setAgencyName('');
        setSelectedOwner(null);
        setSearchQuery('');
        setDirty(false); // Explicitly clear dirty state on reset
    };

    const handleCreateAgency = async (e) => {
        e.preventDefault();
        
        if (!agencyName.trim()) {
            toast({
                title: "Validation Error",
                description: "Agency name is required",
                variant: "destructive"
            });
            return;
        }

        if (!selectedOwner) {
            toast({
                title: "Validation Error",
                description: "Please select an agency owner",
                variant: "destructive"
            });
            return;
        }

        setIsCreating(true);
        // Functional log: Critical action tracking
        console.log("Creating agency:", { name: agencyName, owner_id: selectedOwner.profile_id });

        try {
            const { data, error } = await supabase
                .rpc('admin_create_agency_by_profile_id', {
                    p_name: agencyName,
                    p_owner_profile_id: selectedOwner.profile_id
                });

            if (error) throw error;

            console.log("Agency creation response:", data);

            if (data && data.success) {
                // Set success state
                setCreatedAgency({
                    name: agencyName,
                    agency_code: data.agency_code,
                    owner_profile_id: selectedOwner.profile_id,
                    owner_name: selectedOwner.name
                });
                
                clearDraft(DRAFT_KEY); // Clear persisted draft on successful creation
                setDirty(false); // Clear dirty state on success

                toast({
                    title: "Agency Created",
                    description: `Agency created successfully!`,
                    className: "bg-green-50 border-green-200 text-green-800"
                });
                
                // Refresh list
                fetchAgencies();
            } else {
                throw new Error(data?.error || "Unknown error occurred");
            }
        } catch (err) {
            console.error("Error creating agency:", err);
            toast({
                title: "Creation Failed",
                description: err.message || "Failed to create agency",
                variant: "destructive"
            });
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-100 rounded-lg">
                        <Building className="w-6 h-6 text-rose-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Agencies Management</h1>
                        <p className="text-sm text-muted-foreground">Monitor and manage agency performance</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Create Agency Form Card - Takes 1 column on large screens */}
                <Card className="xl:col-span-1 border-rose-100 shadow-md overflow-visible relative h-fit">
                    {!createdAgency ? (
                        <>
                            <CardHeader className="bg-gradient-to-r from-rose-50 to-orange-50 rounded-t-lg pb-4 border-b border-rose-100">
                                <CardTitle className="text-lg flex items-center gap-2 text-rose-900">
                                    <Plus className="w-5 h-5 text-rose-600" />
                                    Create New Agency
                                </CardTitle>
                                <CardDescription>Register a new agency and assign an owner.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-4 overflow-visible">
                                <div className="space-y-2">
                                    <Label htmlFor="agencyName">Agency Name</Label>
                                    <div className="relative">
                                        <Building className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                        <Input 
                                            id="agencyName" 
                                            placeholder="e.g. Elite Talent Agency" 
                                            className="pl-9"
                                            value={agencyName}
                                            onChange={(e) => setAgencyName(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2 relative z-50">
                                    <Label>Agency Owner</Label>
                                    
                                    {!selectedOwner ? (
                                        <div className="relative">
                                            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                            <Input 
                                                ref={searchInputRef}
                                                placeholder="Search by name or profile ID..." 
                                                className="pl-9"
                                                value={searchQuery}
                                                onChange={(e) => {
                                                    setSearchQuery(e.target.value);
                                                    if (!showDropdown) setShowDropdown(true);
                                                }}
                                                onFocus={() => {
                                                    if (searchQuery.length >= 2) setShowDropdown(true);
                                                }}
                                            />
                                            {isSearching && (
                                                <div className="absolute right-3 top-3">
                                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                                </div>
                                            )}

                                            {/* Autocomplete Dropdown */}
                                            {showDropdown && searchQuery.length >= 2 && (
                                                <div 
                                                    ref={dropdownRef}
                                                    className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto z-[100] animate-in fade-in zoom-in-95 duration-100"
                                                >
                                                    {isSearching ? (
                                                        <div className="p-4 text-center text-sm text-muted-foreground">
                                                            Searching...
                                                        </div>
                                                    ) : searchResults.length > 0 ? (
                                                        <div className="py-1">
                                                            {searchResults.map((result) => (
                                                                <button
                                                                    key={result.user_id}
                                                                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                                                                    onClick={() => handleSelectProfile(result)}
                                                                >
                                                                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                                        {result.avatar_url ? (
                                                                            <img src={result.avatar_url} alt={result.name} className="h-full w-full object-cover" />
                                                                        ) : (
                                                                            <User className="h-4 w-4 text-slate-400" />
                                                                        )}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-sm font-medium text-slate-900 truncate">{result.name}</p>
                                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                            <span>ID: {result.profile_id}</span>
                                                                            {result.is_agent && (
                                                                                <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-medium">Agent</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="p-4 text-center text-sm text-muted-foreground">
                                                            No users found
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        /* Selected Owner Display */
                                        <div className="bg-rose-50 border border-rose-100 rounded-md p-3 flex items-center gap-3 group relative">
                                            <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center overflow-hidden border border-rose-100 shadow-sm">
                                                {selectedOwner.avatar_url ? (
                                                    <img src={selectedOwner.avatar_url} alt={selectedOwner.name} className="h-full w-full object-cover" />
                                                ) : (
                                                    <User className="h-5 w-5 text-rose-400" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-900 truncate">{selectedOwner.name}</p>
                                                <p className="text-xs text-slate-500">ID: {selectedOwner.profile_id}</p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center">
                                                    <Check className="h-3.5 w-3.5 text-green-600" />
                                                </div>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                    onClick={handleClearSelection}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                    <p className="text-[11px] text-muted-foreground mt-1.5">
                                        Search for a user to assign as the agency owner.
                                    </p>
                                </div>

                            </CardContent>
                            <CardFooter className="pt-2">
                                <Button 
                                    className="w-full bg-rose-600 hover:bg-rose-700 text-white" 
                                    onClick={handleCreateAgency}
                                    disabled={isCreating || !selectedOwner || !agencyName}
                                >
                                    {isCreating ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
                                        </>
                                    ) : (
                                        "Create Agency"
                                    )}
                                </Button>
                            </CardFooter>
                        </>
                    ) : (
                        // SUCCESS STATE PANEL
                        <div className="absolute inset-0 bg-white rounded-lg z-10 flex flex-col animate-in fade-in zoom-in-95 duration-300">
                             <div className="bg-green-50 rounded-t-lg p-6 flex flex-col items-center justify-center text-center border-b border-green-100">
                                <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mb-4 border-4 border-white shadow-sm">
                                    <Check className="h-8 w-8 text-green-600" />
                                </div>
                                <h3 className="text-xl font-bold text-green-800">Agency Created!</h3>
                                <p className="text-green-600 text-sm mt-1">
                                    The agency has been successfully registered.
                                </p>
                             </div>
                             
                             <div className="p-6 space-y-5 flex-1 overflow-y-auto">
                                <div className="space-y-1">
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Agency Name</p>
                                    <p className="text-lg font-semibold text-gray-900">{createdAgency.name}</p>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</p>
                                    <div className="flex items-center gap-2">
                                        <p className="text-base font-medium text-gray-900">{createdAgency.owner_name}</p>
                                        <span className="text-sm text-gray-400">({createdAgency.owner_profile_id})</span>
                                    </div>
                                </div>

                                <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Agency Code</p>
                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 bg-white px-3 py-2 rounded border border-slate-200 font-mono text-lg font-bold text-slate-800 tracking-wide text-center">
                                            {createdAgency.agency_code}
                                        </code>
                                        <Button 
                                            variant="outline" 
                                            size="icon" 
                                            className="h-11 w-11 shrink-0 bg-white hover:bg-slate-50"
                                            onClick={handleCopyCode}
                                            title="Copy Code"
                                        >
                                            <Copy className="h-5 w-5 text-slate-500" />
                                        </Button>
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-2 text-center">
                                        Share this code with users to let them join this agency.
                                    </p>
                                </div>
                             </div>

                             <div className="p-6 pt-2 mt-auto border-t border-slate-100">
                                <Button 
                                    className="w-full" 
                                    variant="outline"
                                    onClick={handleResetForm}
                                >
                                    <ArrowLeft className="mr-2 h-4 w-4" /> Create Another
                                </Button>
                             </div>
                        </div>
                    )}
                </Card>

                {/* Agencies List Panel - Takes 2 columns on large screens */}
                <div className="xl:col-span-2 space-y-6">
                    <Card className="h-full border-slate-200 shadow-sm flex flex-col">
                        <CardHeader className="border-b border-slate-100 py-4 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-lg text-slate-900">Registered Agencies</CardTitle>
                                <CardDescription>List of all agencies currently in the system.</CardDescription>
                            </div>
                            <Button variant="ghost" size="sm" onClick={fetchAgencies} disabled={isLoadingAgencies} className="h-8">
                                <RefreshCw className={cn("h-4 w-4 mr-2", isLoadingAgencies && "animate-spin")} />
                                Refresh
                            </Button>
                        </CardHeader>
                        
                        <div className="flex-1 overflow-auto min-h-[400px]">
                            {isLoadingAgencies ? (
                                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                                    <Loader2 className="h-8 w-8 animate-spin mb-2" />
                                    <p className="text-sm">Loading agencies...</p>
                                </div>
                            ) : agenciesError ? (
                                <div className="flex flex-col items-center justify-center h-64 text-red-500">
                                    <AlertCircle className="h-8 w-8 mb-2" />
                                    <p className="text-sm font-medium">Failed to load agencies</p>
                                    <p className="text-xs text-red-400 mt-1">{agenciesError}</p>
                                    <Button variant="outline" size="sm" onClick={fetchAgencies} className="mt-4">Try Again</Button>
                                </div>
                            ) : agencies.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                                    <Building className="h-10 w-10 mb-3 text-slate-200" />
                                    <p className="text-sm font-medium text-slate-600">No agencies found</p>
                                    <p className="text-xs">Create your first agency using the form.</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                                            <TableHead className="w-[250px]">Agency Name</TableHead>
                                            <TableHead className="w-[120px]">Code</TableHead>
                                            <TableHead className="w-[200px]">Owner</TableHead>
                                            <TableHead className="w-[100px]">Status</TableHead>
                                            <TableHead className="text-right">Created</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {agencies.map((agency) => (
                                            <TableRow key={agency.id} className="hover:bg-slate-50">
                                                <TableCell className="font-medium text-slate-900">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-8 w-8 rounded bg-rose-100 flex items-center justify-center text-rose-700 font-bold text-xs shrink-0">
                                                            {agency.name.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        {agency.name}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1.5">
                                                        <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono font-medium text-slate-700 border border-slate-200">
                                                            {agency.agency_code}
                                                        </code>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-5 w-5 text-slate-400 hover:text-slate-600"
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(agency.agency_code);
                                                                toast({ title: "Copied!", description: "Code copied to clipboard", duration: 2000 });
                                                            }}
                                                        >
                                                            <Copy className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {agency.owner ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-6 w-6 rounded-full bg-slate-100 overflow-hidden flex-shrink-0">
                                                                {agency.owner.avatar_url ? (
                                                                    <img src={agency.owner.avatar_url} alt={agency.owner.name} className="h-full w-full object-cover" />
                                                                ) : (
                                                                    <User className="h-3 w-3 m-1.5 text-slate-400" />
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-medium text-slate-700 truncate max-w-[120px]">{agency.owner.name}</span>
                                                                <span className="text-[10px] text-slate-500">ID: {agency.owner.profile_id}</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-red-400 italic">Owner not found</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge 
                                                        variant={agency.is_active ? "success" : "secondary"}
                                                        className={cn(
                                                            "font-normal",
                                                            agency.is_active ? "bg-green-100 text-green-700 hover:bg-green-100 border-green-200" : "bg-slate-100 text-slate-500"
                                                        )}
                                                    >
                                                        {agency.is_active ? "Active" : "Inactive"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-500">
                                                    {format(new Date(agency.created_at), 'MMM d, yyyy')}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default AdminAgencies;