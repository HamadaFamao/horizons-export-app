import { useTranslation } from 'react-i18next';

export function useLanguage() {
  const { i18n } = useTranslation();
  return {
    language: i18n.language,
    isRTL: i18n.dir() === 'rtl',
    t: i18n.t,
    changeLanguage: i18n.changeLanguage
  };
}