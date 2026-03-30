import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// Simple in-memory cache to avoid repeated fetches
let cachedCountries = null;

const useCountries = () => {
    const [countries, setCountries] = useState(cachedCountries || []);
    const [loading, setLoading] = useState(!cachedCountries);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (cachedCountries) {
            setLoading(false);
            return;
        }

        const fetchCountries = async () => {
            try {
                setLoading(true);
                const { data, error: fetchError } = await supabase
                    .from('countries')
                    .select('code, name_en, name_ar, flag')
                    .order('name_en', { ascending: true });

                if (fetchError) {
                    throw fetchError;
                }

                cachedCountries = data;
                setCountries(data);
            } catch (err) {
                setError(err);
                console.error("Error fetching countries:", err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchCountries();
    }, []);

    return { countries, loading, error };
};

export default useCountries;