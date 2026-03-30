import React, { useState, useEffect } from 'react';
import { getCountryByCode } from '@/lib/countries';
import { Loader2 } from 'lucide-react';

export default function CountryDisplay({ code, prefix }) {
  const [country, setCountry] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) {
      setLoading(false);
      return;
    }

    const loadCountry = async () => {
      try {
        setLoading(true);
        const data = await getCountryByCode(code);
        setCountry(data);
      } catch (err) {
        console.error('Error loading country:', err);
        setCountry(null);
      } finally {
        setLoading(false);
      }
    };

    loadCountry();
  }, [code]);

  if (!code || loading) return null;
  if (!country) return null;

  return (
    <div className="flex items-center gap-2">
      {country.flagUrl && (
        <img
          src={country.flagUrl}
          alt={country.name}
          className="h-4 w-6 rounded-sm object-cover shadow-sm"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      )}
      <span className="text-sm text-gray-600">
        {prefix ? `${prefix} ` : ''}{country.name}
      </span>
    </div>
  );
}