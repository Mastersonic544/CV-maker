import React, { createContext, useContext, useEffect, useState } from 'react';

const TRANSLATIONS = {
  en: {
    // Nav
    nav_pipeline: 'Pipeline',
    nav_dashboard: 'Dashboard',
    nav_discovery: 'Discovery',
    nav_review: 'Review',
    nav_apply: 'Apply',
    nav_interview: 'Interview',
    // Header
    header_live: 'Live',
    // Banner
    banner_profile_incomplete: 'PROFILE INCOMPLETE.',
    banner_missing_fields: 'Missing {n} fields. Better data, better output.',
    banner_complete_now: 'Complete now',
    // Setup APIs page
    setup_title: "You're ready to go.",
    setup_subtitle: 'AI features work out of the box. Add keys below to unlock Easy Apply and email.',
    setup_phase: 'Phase 02 / Optional Setup',
    setup_encrypted: 'Encrypted at rest',
    setup_optional_section: 'Optional — unlock Easy Apply and email',
    setup_save_keys: 'Save {n} key{s} and continue',
    setup_continue: 'Continue to app',
    setup_skip: 'Skip — add later from the dashboard.',
    // Profile selector
    selector_title: 'Choose a profile.',
    selector_new: 'Create new profile',
    selector_switch: 'Switch profile',
    // Onboarding
    onboarding_continue: 'Continue',
    onboarding_back: 'Back',
    onboarding_finish: 'Build my profile',
    // Common
    loading: 'Loading...',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    close: 'Close',
    // Dashboard
    dash_history_title: 'Application History',
    dash_no_history: 'No applications yet.',
    // Discovery
    disc_title: 'Job Discovery',
    // Review
    review_title: 'CV Review',
    // Apply
    apply_title: 'Auto Apply',
    // Interview
    interview_title: 'Interview Simulator',
  },
  fr: {
    nav_pipeline: 'Pipeline',
    nav_dashboard: 'Tableau de bord',
    nav_discovery: 'Découverte',
    nav_review: 'Révision',
    nav_apply: 'Postuler',
    nav_interview: 'Entretien',
    header_live: 'En direct',
    banner_profile_incomplete: 'PROFIL INCOMPLET.',
    banner_missing_fields: '{n} champs manquants. Plus de données, meilleur résultat.',
    banner_complete_now: 'Compléter',
    setup_title: 'Vous êtes prêt.',
    setup_subtitle: "Les fonctions IA fonctionnent immédiatement. Ajoutez les clés ci-dessous pour activer Easy Apply.",
    setup_phase: 'Phase 02 / Configuration optionnelle',
    setup_encrypted: 'Chiffré au repos',
    setup_optional_section: 'Optionnel — activer Easy Apply et email',
    setup_save_keys: 'Enregistrer {n} clé{s} et continuer',
    setup_continue: "Continuer vers l'application",
    setup_skip: 'Passer — ajouter plus tard depuis le tableau de bord.',
    selector_title: 'Choisissez un profil.',
    selector_new: 'Créer un nouveau profil',
    selector_switch: 'Changer de profil',
    onboarding_continue: 'Continuer',
    onboarding_back: 'Retour',
    onboarding_finish: 'Créer mon profil',
    loading: 'Chargement...',
    save: 'Enregistrer',
    cancel: 'Annuler',
    delete: 'Supprimer',
    edit: 'Modifier',
    close: 'Fermer',
    dash_history_title: 'Historique des candidatures',
    dash_no_history: "Aucune candidature pour l'instant.",
    disc_title: "Découverte d'emplois",
    review_title: 'Révision du CV',
    apply_title: 'Candidature automatique',
    interview_title: "Simulateur d'entretien",
  },
  ar: {
    nav_pipeline: 'المسار',
    nav_dashboard: 'لوحة التحكم',
    nav_discovery: 'الاستكشاف',
    nav_review: 'المراجعة',
    nav_apply: 'التقديم',
    nav_interview: 'المقابلة',
    header_live: 'مباشر',
    banner_profile_incomplete: 'الملف الشخصي غير مكتمل.',
    banner_missing_fields: '{n} حقول مفقودة. بيانات أفضل، نتائج أفضل.',
    banner_complete_now: 'أكمل الآن',
    setup_title: 'أنت جاهز للانطلاق.',
    setup_subtitle: 'ميزات الذكاء الاصطناعي تعمل فوراً. أضف المفاتيح أدناه لتفعيل التقديم التلقائي.',
    setup_phase: 'المرحلة ٠٢ / إعداد اختياري',
    setup_encrypted: 'مشفّر محلياً',
    setup_optional_section: 'اختياري — تفعيل التقديم التلقائي والبريد',
    setup_save_keys: 'حفظ {n} مفتاح ومتابعة',
    setup_continue: 'المتابعة إلى التطبيق',
    setup_skip: 'تخطي — الإضافة لاحقاً من لوحة التحكم.',
    selector_title: 'اختر ملفاً شخصياً.',
    selector_new: 'إنشاء ملف جديد',
    selector_switch: 'تبديل الملف',
    onboarding_continue: 'متابعة',
    onboarding_back: 'رجوع',
    onboarding_finish: 'بناء ملفي الشخصي',
    loading: 'جار التحميل...',
    save: 'حفظ',
    cancel: 'إلغاء',
    delete: 'حذف',
    edit: 'تعديل',
    close: 'إغلاق',
    dash_history_title: 'سجل الطلبات',
    dash_no_history: 'لا توجد طلبات بعد.',
    disc_title: 'استكشاف الوظائف',
    review_title: 'مراجعة السيرة الذاتية',
    apply_title: 'التقديم التلقائي',
    interview_title: 'محاكي المقابلة',
  },
};

const I18nContext = createContext();

export const I18nProvider = ({ children }) => {
  const [lang, setLang] = useState(() => localStorage.getItem('cv_lang') || 'en');

  useEffect(() => {
    localStorage.setItem('cv_lang', lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  const t = (key, vars = {}) => {
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
    const fallback = TRANSLATIONS.en;
    let str = dict[key] !== undefined ? dict[key] : (fallback[key] !== undefined ? fallback[key] : key);
    // Simple {n} and {s} substitution
    Object.entries(vars).forEach(([k, v]) => {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    });
    return str;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);
