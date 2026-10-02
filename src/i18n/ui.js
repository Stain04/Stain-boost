// Interface text in English and Arabic (menu, footer, shared bits).
// The order pages (pricing, checkout, dashboard) are English-only for now; Arabic pages link to them.
import { STATS } from '../data/site.js';

export const LANGS = ['en', 'ar'];

export const UI = {
  en: {
    home: 'Home', homeHref: '/',
    nav: [
      { href: '/pricing', label: 'Pricing' },
      { href: '/reviews', label: 'Reviews' },
      { href: '/faq', label: 'FAQ' },
      { href: '/blog', label: 'Blog' },
    ],
    signIn: 'Sign in', dashboard: 'Dashboard', order: 'Order', seePrice: 'See my price',
    openMenu: 'Open menu', otherLang: 'العربية', otherLangLabel: 'اقرأ هذه الصفحة بالعربية',
    chat: 'Ask a question',
    footerAbout: `League of Legends ELO boosting on ME, EUW and EUNE, played personally by Stain. ${STATS.ordersCompleted}+ orders, ${STATS.bans} bans.`,
    footerCols: [
      { title: 'Boosting', links: [['/pricing', 'Rank boost'], ['/pricing?mode=wins', 'Net wins'], ['/boost', 'All boosts'], ['/reviews', 'Verified reviews']] },
      { title: 'Popular boosts', links: [['/boost/silver-to-gold', 'Silver to Gold'], ['/boost/gold-to-platinum', 'Gold to Platinum'], ['/boost/platinum-to-emerald', 'Platinum to Emerald'], ['/boost/emerald-to-diamond', 'Emerald to Diamond']] },
      { title: 'Help', links: [['/faq', 'FAQ'], ['/blog', 'Blog'], ['/dashboard', 'Track my order']] },
      { title: 'Legal', links: [['/privacy', 'Privacy'], ['/terms', 'Terms']] },
    ],
    legal: (year) => `© ${year} StainBoost. League of Legends is a trademark of Riot Games, Inc. StainBoost is not affiliated with or endorsed by Riot Games.`,
  },
  ar: {
    home: 'الرئيسية', homeHref: '/ar',
    nav: [
      { href: '/pricing', label: 'الأسعار' },
      { href: '/ar#boosts', label: 'أنواع البوست' },
      { href: '/ar#faq', label: 'الأسئلة الشائعة' },
      { href: '/reviews', label: 'التقييمات' },
    ],
    signIn: 'تسجيل الدخول', dashboard: 'لوحة التحكم', order: 'اطلب الآن', seePrice: 'احسب سعري',
    openMenu: 'فتح القائمة', otherLang: 'English', otherLangLabel: 'Read this page in English',
    chat: 'اسأل سؤالًا',
    footerAbout: `رفع رانك ليج أوف ليجندز على سيرفرات ME و EUW و EUNE، يلعبه Stain بنفسه. أكثر من ${STATS.ordersCompleted} طلب مكتمل، و${STATS.bans} باند.`,
    footerCols: [
      { title: 'البوست', links: [['/pricing', 'رفع الرانك'], ['/pricing?mode=wins', 'انتصارات صافية'], ['/ar#boosts', 'كل أنواع البوست'], ['/reviews', 'تقييمات موثّقة']] },
      { title: 'الأكثر طلبًا', links: [['/ar/boost/silver-to-gold', 'سيلفر إلى جولد'], ['/ar/boost/gold-to-platinum', 'جولد إلى بلاتينيوم'], ['/ar/boost/platinum-to-emerald', 'بلاتينيوم إلى إيميرالد'], ['/ar/boost/emerald-to-diamond', 'إيميرالد إلى دايموند']] },
      { title: 'مساعدة', links: [['/ar#faq', 'الأسئلة الشائعة'], ['/blog', 'المدونة (بالإنجليزية)'], ['/dashboard', 'تتبّع طلبي']] },
      { title: 'قانوني', links: [['/privacy', 'الخصوصية'], ['/terms', 'الشروط']] },
    ],
    legal: (year) => `© ${year} StainBoost. ليج أوف ليجندز علامة تجارية لشركة Riot Games, Inc. ولا ترتبط StainBoost بشركة Riot Games ولا تحظى بتأييدها.`,
  },
};

/** Tier names as players say them in each language (Masters = the Master tier). */
export const TIER_NAMES = {
  en: { Iron: 'Iron', Bronze: 'Bronze', Silver: 'Silver', Gold: 'Gold', Platinum: 'Platinum', Emerald: 'Emerald', Diamond: 'Diamond', Masters: 'Master' },
  ar: { Iron: 'آيرون', Bronze: 'برونز', Silver: 'سيلفر', Gold: 'جولد', Platinum: 'بلاتينيوم', Emerald: 'إيميرالد', Diamond: 'دايموند', Masters: 'ماستر' },
};
