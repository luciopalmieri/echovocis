const LANGUAGE_FLAGS: Record<string, string> = {
  en: "\u{1F1EC}\u{1F1E7}",
  it: "\u{1F1EE}\u{1F1F9}",
  fr: "\u{1F1EB}\u{1F1F7}",
  de: "\u{1F1E9}\u{1F1EA}",
  es: "\u{1F1EA}\u{1F1F8}",
  pt: "\u{1F1F5}\u{1F1F9}",
  ja: "\u{1F1EF}\u{1F1F5}",
  ko: "\u{1F1F0}\u{1F1F7}",
  zh: "\u{1F1E8}\u{1F1F3}",
  ru: "\u{1F1F7}\u{1F1FA}",
  hi: "\u{1F1EE}\u{1F1F3}",
  ar: "\u{1F1E6}\u{1F1EA}",
  tr: "\u{1F1F9}\u{1F1F7}",
  id: "\u{1F1EE}\u{1F1E9}",
  vi: "\u{1F1FB}\u{1F1F3}",
  bn: "\u{1F1E7}\u{1F1F9}",
};

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  it: "Italian",
  fr: "French",
  de: "German",
  es: "Spanish",
  pt: "Portuguese",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  ru: "Russian",
  hi: "Hindi",
  ar: "Arabic",
  tr: "Turkish",
  id: "Indonesian",
  vi: "Vietnamese",
  bn: "Bengali",
};

export function LanguageFlag({ code }: { code: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span>{LANGUAGE_FLAGS[code] || "\u{1F310}"}</span>
      <span>{LANGUAGE_NAMES[code] || code}</span>
    </span>
  );
}

export const SUPPORTED_LANGUAGES = Object.keys(LANGUAGE_NAMES);
