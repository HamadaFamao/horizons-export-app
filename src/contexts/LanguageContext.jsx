import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthContext';

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const [language, setLanguage] = useState(i18n.language || 'en');

  // Effect to update language when i18n instance changes or user logs in/out
  useEffect(() => {
    const handleLanguageChange = (lng) => {
      const sanitizedLng = (typeof lng === 'string' && lng) ? lng : 'en';
      setLanguage(sanitizedLng);
      document.documentElement.lang = sanitizedLng;
      document.documentElement.dir = i18n.dir(sanitizedLng);
    };

    i18n.on('languageChanged', handleLanguageChange);
    
    // Set initial language correctly
    handleLanguageChange(i18n.language);

    // Re-detect language when user auth state changes
    if (user) {
        i18n.reloadResources(i18n.languages);
    }

    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n, user]);

  const changeLanguage = useCallback((lng) => {
    if (typeof lng === 'string' && lng) {
      i18n.changeLanguage(lng);
    }
  }, [i18n]);

  const value = {
    language,
    changeLanguage,
    isRTL: language === 'ar'
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};