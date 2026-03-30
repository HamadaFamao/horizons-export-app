import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { getAllCountries } from '@/lib/countries';
import CountrySelect from '@/components/CountrySelect';
import UserCard from '@/components/UserCard'; 

export default function SearchPage() {
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    name: '',
    gender: '',
    living_in_code: '',
    ageMin: 18,
    ageMax: 65,
    marital_status: '',
    looking_for: '',
    has_photos: false,
    online_only: false,
  });

  const [countries, setCountries] = useState([]);
  const [genderOptions, setGenderOptions] = useState([]);
  const [maritalStatusOptions, setMaritalStatusOptions] = useState([]);
  const [lookingForOptions, setLookingForOptions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [resultCount, setResultCount] = useState(0);

  // Load filter options on mount
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        setLoading(true);

        // Load countries
        const countriesData = await getAllCountries();
        setCountries(countriesData);

        // Load unique values for other filters from profiles
        const { data: profiles } = await supabase
          .from('profiles')
          .select('gender, marital_status, lookingfor');

        if (profiles) {
          const genders = [...new Set(profiles.map(p => p.gender).filter(Boolean))].sort();
          const maritalStatuses = [...new Set(profiles.map(p => p.marital_status).filter(Boolean))].sort();
          const lookingFor = [...new Set(profiles.map(p => p.lookingfor).filter(Boolean))].sort();

          setGenderOptions(genders);
          setMaritalStatusOptions(maritalStatuses);
          setLookingForOptions(lookingFor);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error loading filter options:', error);
        setLoading(false);
      }
    };

    loadFilterOptions();
  }, []);

  // Handle filter changes
  const handleFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // Handle country select change
  const handleCountryChange = (code) => {
    setFilters(prev => ({
      ...prev,
      living_in_code: code,
    }));
  };

  // Perform search
  const handleSearch = async () => {
    try {
      setSearching(true);

      let query = supabase
        .from('profiles')
        .select('*', { count: 'exact' });

      // Apply filters only if they are set
      if (filters.name) {
        query = query.ilike('name', `%${filters.name}%`);
      }

      if (filters.gender) {
        query = query.eq('gender', filters.gender);
      }

      if (filters.living_in_code) {
        // Filter by code (preferred) or fallback to legacy country text
        query = query.or(`living_in_code.eq.${filters.living_in_code},living_in.ilike.%${filters.living_in_code}%`);
      }

      if (filters.ageMin) {
        query = query.gte('age', filters.ageMin);
      }

      if (filters.ageMax) {
        query = query.lte('age', filters.ageMax);
      }

      if (filters.marital_status) {
        query = query.eq('marital_status', filters.marital_status);
      }

      if (filters.looking_for) {
        query = query.eq('lookingfor', filters.looking_for);
      }

      const { data, error, count } = await query.limit(50);

      if (error) {
        console.error('Search error:', error);
        setResults([]);
        setResultCount(0);
      } else {
        // Post-filter for has_photos and online_only if needed
        let filteredData = data || [];

        if (filters.has_photos) {
          filteredData = filteredData.filter(user => 
            user.photos && Array.isArray(user.photos) && user.photos.length > 0
          );
        }

        if (filters.online_only) {
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
          filteredData = filteredData.filter(user => 
            user.last_seen && new Date(user.last_seen) > new Date(fiveMinutesAgo)
          );
        }

        setResults(filteredData);
        setResultCount(filteredData.length);
      }

      setSearching(false);
    } catch (error) {
      console.error('Error searching:', error);
      setResults([]);
      setResultCount(0);
      setSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pb-24 md:pb-8">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Search</h1>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-20">
              <h2 className="text-lg font-bold text-gray-900 mb-6">Filters</h2>

              <div className="space-y-6">
                {/* Name Filter */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={filters.name}
                    onChange={handleFilterChange}
                    placeholder="Search by name…"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm"
                  />
                </div>

                {/* Gender Filter */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Gender
                  </label>
                  <select
                    name="gender"
                    value={filters.gender}
                    onChange={handleFilterChange}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition appearance-none bg-white text-sm"
                  >
                    <option value="">Any gender</option>
                    {genderOptions.map((gender) => (
                      <option key={gender} value={gender}>
                        {gender.charAt(0).toUpperCase() + gender.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Country Filter */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Living In
                  </label>
                  <CountrySelect
                    value={filters.living_in_code}
                    onChange={handleCountryChange}
                    placeholder="All countries"
                  />
                </div>

                {/* Age Range Filter */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Age Range
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      name="ageMin"
                      value={filters.ageMin}
                      onChange={handleFilterChange}
                      min="18"
                      max="120"
                      className="w-1/2 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm"
                      placeholder="Min"
                    />
                    <input
                      type="number"
                      name="ageMax"
                      value={filters.ageMax}
                      onChange={handleFilterChange}
                      min="18"
                      max="120"
                      className="w-1/2 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm"
                      placeholder="Max"
                    />
                  </div>
                </div>

                {/* Marital Status Filter */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Marital Status
                  </label>
                  <select
                    name="marital_status"
                    value={filters.marital_status}
                    onChange={handleFilterChange}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition appearance-none bg-white text-sm"
                  >
                    <option value="">Any status</option>
                    {maritalStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Looking For Filter */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Looking For
                  </label>
                  <select
                    name="looking_for"
                    value={filters.looking_for}
                    onChange={handleFilterChange}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition appearance-none bg-white text-sm"
                  >
                    <option value="">Any type</option>
                    {lookingForOptions.map((type) => (
                      <option key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Has Photos Toggle */}
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="has_photos"
                      checked={filters.has_photos}
                      onChange={handleFilterChange}
                      className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Only with photos
                    </span>
                  </label>
                </div>

                {/* Online Only Toggle */}
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="online_only"
                      checked={filters.online_only}
                      onChange={handleFilterChange}
                      className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Online now only
                    </span>
                  </label>
                </div>

                {/* Search Button */}
                <button
                  onClick={handleSearch}
                  disabled={searching}
                  className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-semibold rounded-lg transition"
                >
                  {searching ? 'Searching...' : 'Search'}
                </button>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="lg:col-span-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                Results ({resultCount})
              </h2>

              {results.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {results.map((user) => (
                    <UserCard
                      key={user.id}
                      profile={user}
                      onClick={() => navigate(`/user/${user.profile_id}`)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-white rounded-2xl">
                  <p className="text-gray-600">
                    {Object.values(filters).some(v => v && v !== 18 && v !== 65 && v !== false)
                      ? 'No results found. Try adjusting your filters.'
                      : 'Select filters and click Search to find matches.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}