import React, { useState, useEffect } from 'react';
import { getAllCountries } from '@/lib/countries';
import { Loader2 } from 'lucide-react';

export default function CountrySelect({
  value,
  onChange,
  placeholder = 'Select country…',
  disabled = false,
}) {
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load countries on mount
  useEffect(() => {
    const loadCountries = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getAllCountries();
        if (data && data.length > 0) {
          setCountries(data);
        } else {
          setError('No countries available');
        }
      } catch (err) {
        console.error('Error loading countries:', err);
        setError('Failed to load countries');
      } finally {
        setLoading(false);
      }
    };

    loadCountries();
  }, []);

  const handleChange = (e) => {
    const selectedCode = e.target.value;
    onChange(selectedCode || null);
  };

  return (
    <div className="w-full">
      <div className="relative">
        <select
          value={value || ''}
          onChange={handleChange}
          disabled={disabled || loading}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition appearance-none bg-white pr-10 text-gray-900"
        >
          <option value="">
            {loading ? 'Loading countries...' : placeholder}
          </option>

          {countries.length > 0 ? (
            countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))
          ) : (
            !loading && <option disabled>No countries available</option>
          )}
        </select>

        {/* Dropdown arrow */}
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && !loading && (
        <p className="mt-2 text-xs text-amber-600">
          ⚠️ {error}. You can still save other fields.
        </p>
      )}
    </div>
  );
}