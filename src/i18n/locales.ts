// Website languages. Plain module: safe for client and server.

export const LOCALES = ["en", "nl", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "vim_lang";

export const LOCALE_LABELS: Record<Locale, { short: string; name: string; dir: "ltr" | "rtl" }> = {
  en: { short: "EN", name: "English", dir: "ltr" },
  nl: { short: "NL", name: "Nederlands", dir: "ltr" },
  ar: { short: "عربي", name: "العربية", dir: "rtl" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Languages offered through Google Translate ("⋯" menu): code + name in its own language. */
export const WORLD_LANGUAGES: { code: string; name: string }[] = [
  { code: "af", name: "Afrikaans" }, { code: "sq", name: "Shqip" }, { code: "am", name: "አማርኛ" },
  { code: "ar", name: "العربية" }, { code: "hy", name: "Հայերեն" }, { code: "as", name: "অসমীয়া" },
  { code: "ay", name: "Aymar aru" }, { code: "az", name: "Azərbaycan" }, { code: "bm", name: "Bamanankan" },
  { code: "eu", name: "Euskara" }, { code: "be", name: "Беларуская" }, { code: "bn", name: "বাংলা" },
  { code: "bho", name: "भोजपुरी" }, { code: "bs", name: "Bosanski" }, { code: "bg", name: "Български" },
  { code: "ca", name: "Català" }, { code: "ceb", name: "Cebuano" }, { code: "ny", name: "Chichewa" },
  { code: "zh-CN", name: "中文（简体）" }, { code: "zh-TW", name: "中文（繁體）" }, { code: "co", name: "Corsu" },
  { code: "hr", name: "Hrvatski" }, { code: "cs", name: "Čeština" }, { code: "da", name: "Dansk" },
  { code: "dv", name: "ދިވެހި" }, { code: "doi", name: "डोगरी" }, { code: "nl", name: "Nederlands" },
  { code: "en", name: "English" }, { code: "eo", name: "Esperanto" }, { code: "et", name: "Eesti" },
  { code: "ee", name: "Eʋegbe" }, { code: "tl", name: "Filipino" }, { code: "fi", name: "Suomi" },
  { code: "fr", name: "Français" }, { code: "fy", name: "Frysk" }, { code: "gl", name: "Galego" },
  { code: "ka", name: "ქართული" }, { code: "de", name: "Deutsch" }, { code: "el", name: "Ελληνικά" },
  { code: "gn", name: "Avañe'ẽ" }, { code: "gu", name: "ગુજરાતી" }, { code: "ht", name: "Kreyòl ayisyen" },
  { code: "ha", name: "Hausa" }, { code: "haw", name: "ʻŌlelo Hawaiʻi" }, { code: "iw", name: "עברית" },
  { code: "hi", name: "हिन्दी" }, { code: "hmn", name: "Hmoob" }, { code: "hu", name: "Magyar" },
  { code: "is", name: "Íslenska" }, { code: "ig", name: "Igbo" }, { code: "ilo", name: "Ilokano" },
  { code: "id", name: "Bahasa Indonesia" }, { code: "ga", name: "Gaeilge" }, { code: "it", name: "Italiano" },
  { code: "ja", name: "日本語" }, { code: "jw", name: "Basa Jawa" }, { code: "kn", name: "ಕನ್ನಡ" },
  { code: "kk", name: "Қазақ" }, { code: "km", name: "ខ្មែរ" }, { code: "rw", name: "Kinyarwanda" },
  { code: "gom", name: "कोंकणी" }, { code: "ko", name: "한국어" }, { code: "kri", name: "Krio" },
  { code: "ku", name: "Kurdî" }, { code: "ckb", name: "کوردی" }, { code: "ky", name: "Кыргызча" },
  { code: "lo", name: "ລາວ" }, { code: "la", name: "Latina" }, { code: "lv", name: "Latviešu" },
  { code: "ln", name: "Lingála" }, { code: "lt", name: "Lietuvių" }, { code: "lg", name: "Luganda" },
  { code: "lb", name: "Lëtzebuergesch" }, { code: "mk", name: "Македонски" }, { code: "mai", name: "मैथिली" },
  { code: "mg", name: "Malagasy" }, { code: "ms", name: "Bahasa Melayu" }, { code: "ml", name: "മലയാളം" },
  { code: "mt", name: "Malti" }, { code: "mi", name: "Māori" }, { code: "mr", name: "मराठी" },
  { code: "mni-Mtei", name: "ꯃꯤꯇꯩꯂꯣꯟ" }, { code: "lus", name: "Mizo ṭawng" }, { code: "mn", name: "Монгол" },
  { code: "my", name: "မြန်မာ" }, { code: "ne", name: "नेपाली" }, { code: "no", name: "Norsk" },
  { code: "or", name: "ଓଡ଼ିଆ" }, { code: "om", name: "Afaan Oromoo" }, { code: "ps", name: "پښتو" },
  { code: "fa", name: "فارسی" }, { code: "pl", name: "Polski" }, { code: "pt", name: "Português" },
  { code: "pa", name: "ਪੰਜਾਬੀ" }, { code: "qu", name: "Runasimi" }, { code: "ro", name: "Română" },
  { code: "ru", name: "Русский" }, { code: "sm", name: "Gagana Sāmoa" }, { code: "sa", name: "संस्कृतम्" },
  { code: "gd", name: "Gàidhlig" }, { code: "nso", name: "Sepedi" }, { code: "sr", name: "Српски" },
  { code: "st", name: "Sesotho" }, { code: "sn", name: "chiShona" }, { code: "sd", name: "سنڌي" },
  { code: "si", name: "සිංහල" }, { code: "sk", name: "Slovenčina" }, { code: "sl", name: "Slovenščina" },
  { code: "so", name: "Soomaali" }, { code: "es", name: "Español" }, { code: "su", name: "Basa Sunda" },
  { code: "sw", name: "Kiswahili" }, { code: "sv", name: "Svenska" }, { code: "tg", name: "Тоҷикӣ" },
  { code: "ta", name: "தமிழ்" }, { code: "tt", name: "Татар" }, { code: "te", name: "తెలుగు" },
  { code: "th", name: "ไทย" }, { code: "ti", name: "ትግርኛ" }, { code: "ts", name: "Xitsonga" },
  { code: "tr", name: "Türkçe" }, { code: "tk", name: "Türkmen" }, { code: "ak", name: "Twi" },
  { code: "uk", name: "Українська" }, { code: "ur", name: "اردو" }, { code: "ug", name: "ئۇيغۇرچە" },
  { code: "uz", name: "Oʻzbek" }, { code: "vi", name: "Tiếng Việt" }, { code: "cy", name: "Cymraeg" },
  { code: "xh", name: "isiXhosa" }, { code: "yi", name: "ייִדיש" }, { code: "yo", name: "Yorùbá" },
  { code: "zu", name: "isiZulu" }, { code: "ber", name: "ⵜⴰⵎⴰⵣⵉⵖⵜ (Tamazight)" },
];
