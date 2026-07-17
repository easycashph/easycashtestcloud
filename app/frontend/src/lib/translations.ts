/**
 * Proof-of-concept translation dictionary (ADR: LMS language switcher).
 * Filipino here means the mixed Taglish actually spoken in-office, not
 * formal/academic Filipino - English is kept for terms with no natural
 * Tagalog equivalent in this domain (e.g. "Dashboard", "loan", "status").
 * Covers Settings (language switcher's own page) and Dashboard as the
 * first two pages - other pages stay English-only until extended.
 */
export type Language = 'en' | 'fil';

export const translations = {
  en: {
    'settings.title': 'Settings',
    'settings.tab.profile': 'Profile',
    'settings.tab.security': 'Security',
    'settings.tab.theme': 'Theme Color',
    'settings.tab.appearance': 'Appearance',
    'settings.tab.notifications': 'Notifications',
    'settings.tab.language': 'Language',
    'settings.language.title': 'LMS Language',
    'settings.language.description':
      'Choose the language used across the LMS interface. Filipino mixes English and Tagalog - some terms stay in English when there is no natural Tagalog equivalent.',
    'settings.language.english': 'English',
    'settings.language.filipino': 'Filipino',

    'dashboard.overview.title': 'Overview',
    'dashboard.overview.description': 'Portfolio summary across',
    'dashboard.portfolioFilter.title': 'Portfolio Filter',
    'dashboard.stat.activeLoans': 'Total Active Loans',
    'dashboard.stat.collectionsThisMonth': 'Collections This Month',
    'dashboard.stat.overdueAccounts': 'Overdue Accounts',
    'dashboard.stat.portfolioGrowth': 'Portfolio Growth',
    'dashboard.portfolioQuality.title': 'Portfolio Quality Metrics',
    'dashboard.disbursementTrend.title': 'Loan Disbursement Trend',
    'dashboard.collectionsVsTarget.title': 'Collections vs. Target',
    'dashboard.collectionsForecast.title': 'Collections Forecast',
    'dashboard.categoryBreakdown.title': 'Portfolio Breakdown by Loan Category',
    'dashboard.portfolioHealth.title': 'Loan Portfolio Health',
    'dashboard.recommendation.title': 'Recommendation',
    'dashboard.reportsPreview.title': 'Reports',
    'dashboard.reportsPreview.loanReleases': 'Loan Releases (30 days)',
    'dashboard.reportsPreview.collections': 'Collections (30 days)',
    'dashboard.reportsPreview.viewReport': 'Full report',
  },
  fil: {
    'settings.title': 'Mga Setting',
    'settings.tab.profile': 'Profile',
    'settings.tab.security': 'Seguridad',
    'settings.tab.theme': 'Kulay ng Theme',
    'settings.tab.appearance': 'Itsura',
    'settings.tab.notifications': 'Mga Abiso',
    'settings.tab.language': 'Wika',
    'settings.language.title': 'Wika ng LMS',
    'settings.language.description':
      'Piliin ang wikang gagamitin sa buong LMS interface. Ang Filipino ay halo ng English at Tagalog - nananatili sa English ang ilang termino kung walang natural na katumbas sa Tagalog.',
    'settings.language.english': 'English',
    'settings.language.filipino': 'Filipino',

    'dashboard.overview.title': 'Pangkalahatang-ideya',
    'dashboard.overview.description': 'Buod ng portfolio sa',
    'dashboard.portfolioFilter.title': 'Portfolio Filter',
    'dashboard.stat.activeLoans': 'Kabuuang Aktibong Loan',
    'dashboard.stat.collectionsThisMonth': 'Collections Ngayong Buwan',
    'dashboard.stat.overdueAccounts': 'Overdue na Accounts',
    'dashboard.stat.portfolioGrowth': 'Paglago ng Portfolio',
    'dashboard.portfolioQuality.title': 'Portfolio Quality Metrics',
    'dashboard.disbursementTrend.title': 'Trend ng Loan Disbursement',
    'dashboard.collectionsVsTarget.title': 'Collections vs. Target',
    'dashboard.collectionsForecast.title': 'Forecast ng Collections',
    'dashboard.categoryBreakdown.title': 'Portfolio Breakdown ayon sa Loan Category',
    'dashboard.portfolioHealth.title': 'Kalusugan ng Loan Portfolio',
    'dashboard.recommendation.title': 'Rekomendasyon',
    'dashboard.reportsPreview.title': 'Mga Report',
    'dashboard.reportsPreview.loanReleases': 'Loan Releases (30 araw)',
    'dashboard.reportsPreview.collections': 'Collections (30 araw)',
    'dashboard.reportsPreview.viewReport': 'Buong report',
  },
} as const satisfies Record<Language, Record<string, string>>;

export type TranslationKey = keyof (typeof translations)['en'];
