import hljs from "highlight.js/lib/core";
import type { LanguageFn } from "highlight.js";

const languageLoaders = {
  bash: () => import("highlight.js/lib/languages/bash"),
  javascript: () => import("highlight.js/lib/languages/javascript"),
  json: () => import("highlight.js/lib/languages/json"),
  python: () => import("highlight.js/lib/languages/python"),
  ruby: () => import("highlight.js/lib/languages/ruby"),
  typescript: () => import("highlight.js/lib/languages/typescript"),
  xml: () => import("highlight.js/lib/languages/xml"),
} satisfies Record<string, () => Promise<{ default: LanguageFn }>>;

type HighlightLanguage = keyof typeof languageLoaders;

const pendingLanguages = new Map<HighlightLanguage, Promise<void>>();

function languageFromElement(element: Element) {
  return [...element.classList]
    .find((className) => className.startsWith("language-"))
    ?.slice("language-".length);
}

function isHighlightLanguage(language: string): language is HighlightLanguage {
  return Object.hasOwn(languageLoaders, language);
}

async function ensureLanguage(language: HighlightLanguage) {
  if (hljs.getLanguage(language)) return;

  let pending = pendingLanguages.get(language);
  if (!pending) {
    pending = languageLoaders[language]().then((module) => {
      hljs.registerLanguage(language, module.default);
    });
    pendingLanguages.set(language, pending);
  }
  await pending;
}

export async function highlightCodeBlocks(root: ParentNode) {
  const elements = [...root.querySelectorAll<HTMLElement>(
    'pre code[class*="language-"]',
  )];
  const languages = new Set<HighlightLanguage>();

  for (const element of elements) {
    const language = languageFromElement(element);
    if (language && isHighlightLanguage(language)) languages.add(language);
  }
  await Promise.all([...languages].map(ensureLanguage));

  for (const element of elements) {
    const language = languageFromElement(element);
    if (
      language
      && isHighlightLanguage(language)
      && !element.dataset.highlighted
    ) {
      hljs.highlightElement(element);
    }
  }
}
