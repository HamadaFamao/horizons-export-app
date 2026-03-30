import React, { useState, useEffect } from 'react';
import { fetchCountries } from '@/lib/countriesUtils';

export default function CountrySelectDropdown({
  name,
  value,
  onChange,
  label,
  disabled = false,
  showError = false,
}) {
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCountries = async () => {
      const data = await fetchCountries();
      setCountries(data);
      setLoading(false);
    };

    loadCountries();
  }, []);

  // Find the selected country
  const selectedCountry = countries.find(
    c => c.code === value || c.name === value
  );

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <label className="block text-sm font-semibold text-gray-700 mb-3">
        {label}
      </label>

      {showError && (
        <p className="text-xs text-amber-600 mb-2">
          ⚠️ Countries list failed to load. You can still save other fields.
        </p>
      )}

      <div className="relative">
        <select
          name={name}
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          disabled={disabled || loading}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition appearance-none bg-white pr-10"
        >
          <option value="">
            {loading ? 'Loading countries...' : 'Select country...'}
          </option>

          {countries.map((country) => (
            <option key={country.id} value={country.name}>
               {country.flag_emoji} {country.name}
            </option>
          ))}
        </select>

        {/* Dropdown arrow */}
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400">
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
        </div>
      </div>

      {/* Show selected country with flag */}
      {selectedCountry && (
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
          {selectedCountry.flag_emoji && (
            <span className="text-lg">{selectedCountry.flag_emoji}</span>
          )}
          <span>{selectedCountry.name}</span>
        </div>
      )}
    </div>
  );
}