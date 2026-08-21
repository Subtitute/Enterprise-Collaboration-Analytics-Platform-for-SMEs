import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import i18n, { DEFAULT_LANGUAGE, type SupportedLanguage } from '@/i18n';

interface I18nState {
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => void;
}

// 20/08/2026: dung dung quy uoc persist+partialize da co (xem ui.store.ts/auth.store.ts, key
// 'ecap-<ten>') - KHAC 2 store do o 1 diem: can dong bo i18next/document.lang/document.title moi
// khi ngon ngu doi (ke ca luc rehydrate tu localStorage luc mo app - vd nguoi dung tung chon
// 'en', mo lai app phai vao thang tieng Anh, khong phai doi ho tu tay chon lai). `onRehydrateStorage`
// + goi truc tiep trong setLanguage() la 2 diem duy nhat can dong bo side-effect nay.
// document.title doi SAU KHI changeLanguage() xong (Promise) de dich dung ngon ngu MOI, khong
// phai ngon ngu cu con dang active luc goi.
function applyLanguage(language: SupportedLanguage) {
  document.documentElement.lang = language;
  void i18n.changeLanguage(language).then(() => {
    document.title = i18n.t('common:appTitle');
  });
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      language: DEFAULT_LANGUAGE,
      setLanguage: (language) => {
        applyLanguage(language);
        set({ language });
      },
    }),
    {
      name: 'ecap-i18n',
      partialize: (state) => ({ language: state.language }),
      onRehydrateStorage: () => (state) => {
        if (state) applyLanguage(state.language);
      },
    },
  ),
);
