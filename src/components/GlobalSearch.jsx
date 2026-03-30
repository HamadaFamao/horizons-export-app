import React, { useState, useEffect, useRef } from 'react';
    import { useNavigate } from 'react-router-dom';
    import { Search, User } from 'lucide-react';
    import { Input } from '@/components/ui/input';
    import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

    const GlobalSearch = ({ onResultClick }) => {
        const [query, setQuery] = useState('');
        const [results, setResults] = useState([]);
        const [isOpen, setIsOpen] = useState(false);
        const navigate = useNavigate();
        const searchRef = useRef(null);

        useEffect(() => {
            const handleClickOutside = (event) => {
                if (searchRef.current && !searchRef.current.contains(event.target)) {
                    setIsOpen(false);
                }
            };
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }, [searchRef]);

        useEffect(() => {
            if (query.trim() === '') {
                setResults([]);
                setIsOpen(false);
                return;
            }

            const allUsers = JSON.parse(localStorage.getItem('singlesDemoUsers') || '[]');
            
            // Direct navigation for exact Profile ID match
            if (!isNaN(query)) {
                const exactMatch = allUsers.find(u => u.profileId.toString() === query);
                if (exactMatch) {
                    navigate(`/user/${exactMatch.profileId}`);
                    setQuery('');
                    if (onResultClick) onResultClick();
                    return;
                }
            }

            const filteredUsers = allUsers.filter(user => 
                user.name.toLowerCase().includes(query.toLowerCase()) ||
                user.profileId.toString().includes(query)
            );
            
            setResults(filteredUsers.slice(0, 5));
            setIsOpen(true);

        }, [query, navigate, onResultClick]);

        const handleSelect = (profileId) => {
            setQuery('');
            setIsOpen(false);
            navigate(`/user/${profileId}`);
            if (onResultClick) onResultClick();
        };

        const getInitials = (name) => {
            if (!name) return '?';
            return name.split(' ').map(n => n[0]).join('').toUpperCase();
        };

        return (
            <div className="relative w-full md:w-64" ref={searchRef}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search by name or ID..."
                    className="pl-9"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query && setIsOpen(true)}
                />
                {isOpen && results.length > 0 && (
                    <div className="absolute top-full mt-2 w-full bg-white rounded-md shadow-lg border z-50">
                        <ul>
                            {results.map(user => (
                                <li key={user.id}>
                                    <button 
                                        onClick={() => handleSelect(user.profileId)}
                                        className="w-full text-left flex items-center gap-3 p-3 hover:bg-rose-50"
                                    >
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={user.photoUrl} alt={user.name} />
                                            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-semibold">{user.name}</p>
                                            <p className="text-xs text-gray-500">ID: {user.profileId}</p>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        );
    };

    export default GlobalSearch;