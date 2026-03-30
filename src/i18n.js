import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import { supabase } from '@/lib/supabaseClient';

const supabaseDetector = {
  name: 'supabase',
  
  async lookup(options) {
    try {
      // Check for an active session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        return undefined; // No user logged in, so no language to look up
      }

      // Fetch user's profile settings
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('settings')
        .eq('id', session.user.id)
        .single();
    
      // Handle errors or missing profiles gracefully
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error("i18n: Supabase detector lookup error:", error.message);
        return undefined;
      }
      
      // Extract language from settings, ensuring it's a string
      const lang = profile?.settings?.language;
      if (typeof lang === 'string' && lang) {
        return lang;
      }

      return undefined; // No language set in profile
    } catch (e) {
      console.error("i18n: Exception in Supabase detector lookup:", e);
      return undefined;
    }
  },

  async cacheUserLanguage(lng, options) {
    // Only cache if lng is a valid string
    if (typeof lng !== 'string' || !lng) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return; // Can't save language if not logged in
      
      // Update the user's settings with the new language
      const { error } = await supabase
        .from('profiles')
        .update({ settings: { language: lng } })
        .eq('id', session.user.id);
      
      if(error) {
          console.error("i18n: Error saving language to Supabase:", error);
      }
    } catch (e) {
      console.error("i18n: Exception in Supabase detector cacheUserLanguage:", e);
    }
  }
};

const languageDetector = new LanguageDetector();
languageDetector.addDetector(supabaseDetector);

i18n
  .use(HttpBackend)
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en', // Always have a solid fallback
    debug: false,
    ns: ['common', 'profile', 'auth'],
    defaultNS: 'common',
    detection: {
      order: ['supabase', 'localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'], // Cache in localStorage as a backup
    },
    interpolation: {
      escapeValue: false,
    },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    // Ensure the language passed is always valid
    load: 'currentOnly',
    saveMissing: false,
  });

// Sanitize and set language on change
const originalChangeLanguage = i18n.changeLanguage;
i18n.changeLanguage = (lng, ...args) => {
  const sanitizedLng = (typeof lng === 'string' && lng) ? lng : 'en';
  return originalChangeLanguage(sanitizedLng, ...args);
};


i18n.on('languageChanged', (lng) => {
  const sanitizedLng = (typeof lng === 'string' && lng) ? lng : 'en';
  document.documentElement.lang = sanitizedLng;
  document.documentElement.dir = i18n.dir(sanitizedLng);
  if (sanitizedLng === 'ar') {
    document.documentElement.classList.add('rtl');
  } else {
    document.documentElement.classList.remove('rtl');
  }
});

export default i18n;