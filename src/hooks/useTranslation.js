import { useLanguage } from '@/contexts/LanguageContext';
import en from '@/locales/en.json';

// Simple object flattener for easier key lookup (e.g., 'common.cancel')
// Or a deep get function.
function getNestedValue(obj, key) {
  return key.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? acc[part] : undefined, obj);
}

export function useTranslation() {
  // In a real app, this would use the current language from context to load the correct file.
  // For this implementation constraint, we are loading 'en.json' and simulating the hook.
  // Assuming LanguageContext handles language switching, we might need a way to load other locales.
  // However, the request specifically asked for en.json and this hook structure.
  
  // Note: Since we are using a file-based constraint and i18n might be complex, 
  // we'll stick to a simple synchronous lookup against the English locale for now,
  // or use the i18next instance if available from the codebase (src/i18n.js exists in codebase list).
  // But the user asked for a specific manual implementation.
  
  const t = (key, defaultValue = '') => {
    const value = getNestedValue(en, key);
    return value !== undefined ? value : (defaultValue || key);
  };

  return { t };
}