import countries from 'world-countries';

export const COUNTRIES = countries.map(country => ({
  code: country.cca2.toUpperCase(),
  nameEn: country.name.common,
  nameAr: country.translations?.ara?.common ?? country.name.common,
}));

export const COUNTRY_MAP = new Map(
  COUNTRIES.map(country => [country.code, { nameEn: country.nameEn, nameAr: country.nameAr }])
);

export function getCountryOptions(locale = 'en') {
  const options = COUNTRIES.map(country => ({
    value: country.code,
    label: locale === 'ar' ? country.nameAr : country.nameEn,
  }));

  return options.sort((a, b) => a.label.localeCompare(b.label, locale));
}