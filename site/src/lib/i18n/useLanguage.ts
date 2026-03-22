import { useSyncExternalStore } from "react";
import { messages, type Lang, type MessageKey } from "./messages";

let currentLang: Lang = "cn";

function getLang(): Lang {
  if (typeof document === "undefined") return "cn";
  return document.documentElement.getAttribute("data-lang") === "en"
    ? "en"
    : "cn";
}

function subscribe(callback: () => void) {
  currentLang = getLang();

  const observer = new MutationObserver(() => {
    const next = getLang();
    if (next !== currentLang) {
      currentLang = next;
      callback();
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-lang"],
  });

  return () => observer.disconnect();
}

function getSnapshot(): Lang {
  return currentLang;
}

function getServerSnapshot(): Lang {
  return "cn";
}

export function useLanguage() {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function t(key: MessageKey): string {
    return messages[key][lang];
  }

  function localized<T>(cn: T, en: T | undefined | null): T {
    return lang === "en" && en != null ? en : cn;
  }

  return { lang, t, localized };
}
