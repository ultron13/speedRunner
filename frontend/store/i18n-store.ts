import { create } from "zustand";

import type { Locale, Translation } from "@/types";

const LOCALE_KEY = "speedrunner-locale";

const defaultLocale: Locale = { code: "en", name: "English", nativeName: "English" };

const locales: Locale[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "zh", name: "Chinese", nativeName: "中文" },
];

const translations: Record<string, Translation> = {
  en: {
    dashboard: "Dashboard",
    tests: "Tests",
    analytics: "Analytics",
    settings: "Settings",
    profile: "Profile",
    search: "Search",
    create: "Create",
    delete: "Delete",
    save: "Save",
    cancel: "Cancel",
    loading: "Loading...",
    noData: "No data available",
    error: "Error",
    success: "Success",
    warning: "Warning",
  },
  es: {
    dashboard: "Panel",
    tests: "Pruebas",
    analytics: "Analíticas",
    settings: "Configuración",
    profile: "Perfil",
    search: "Buscar",
    create: "Crear",
    delete: "Eliminar",
    save: "Guardar",
    cancel: "Cancelar",
    loading: "Cargando...",
    noData: "No hay datos disponibles",
    error: "Error",
    success: "Éxito",
    warning: "Advertencia",
  },
  fr: {
    dashboard: "Tableau de bord",
    tests: "Tests",
    analytics: "Analytiques",
    settings: "Paramètres",
    profile: "Profil",
    search: "Rechercher",
    create: "Créer",
    delete: "Supprimer",
    save: "Enregistrer",
    cancel: "Annuler",
    loading: "Chargement...",
    noData: "Aucune donnée disponible",
    error: "Erreur",
    success: "Succès",
    warning: "Avertissement",
  },
  de: {
    dashboard: "Dashboard",
    tests: "Tests",
    analytics: "Analytik",
    settings: "Einstellungen",
    profile: "Profil",
    search: "Suchen",
    create: "Erstellen",
    delete: "Löschen",
    save: "Speichern",
    cancel: "Abbrechen",
    loading: "Laden...",
    noData: "Keine Daten verfügbar",
    error: "Fehler",
    success: "Erfolg",
    warning: "Warnung",
  },
  ja: {
    dashboard: "ダッシュボード",
    tests: "テスト",
    analytics: "分析",
    settings: "設定",
    profile: "プロフィール",
    search: "検索",
    create: "作成",
    delete: "削除",
    save: "保存",
    cancel: "キャンセル",
    loading: "読み込み中...",
    noData: "データなし",
    error: "エラー",
    success: "成功",
    warning: "警告",
  },
  zh: {
    dashboard: "仪表板",
    tests: "测试",
    analytics: "分析",
    settings: "设置",
    profile: "个人资料",
    search: "搜索",
    create: "创建",
    delete: "删除",
    save: "保存",
    cancel: "取消",
    loading: "加载中...",
    noData: "无数据",
    error: "错误",
    success: "成功",
    warning: "警告",
  },
};

function getStoredLocale(): Locale {
  if (typeof window === "undefined") return defaultLocale;
  try {
    const stored = localStorage.getItem(LOCALE_KEY);
    return stored ? JSON.parse(stored) : defaultLocale;
  } catch {
    return defaultLocale;
  }
}

export interface I18nStore {
  locale: Locale;
  locales: Locale[];
  setLocale: (code: string) => void;
  t: (key: string) => string;
}

export const useI18nStore = create<I18nStore>((set, get) => ({
  locale: getStoredLocale(),
  locales,

  setLocale: (code) => {
    const locale = locales.find((l) => l.code === code) || defaultLocale;
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCALE_KEY, JSON.stringify(locale));
    }
    set({ locale });
  },

  t: (key) => {
    const { locale } = get();
    const lang = translations[locale.code] || translations.en;
    return (lang[key] as string) || key;
  },
}));
