import React from "react";

export interface BlockEditorIcons {
  slashTextIcon: React.ReactNode;
  slashHeadingIcon: React.ReactNode;
  slashBulletListIcon: React.ReactNode;
  slashOrderedListIcon: React.ReactNode;
  slashTaskListIcon: React.ReactNode;
  slashBlockquoteIcon: React.ReactNode;
  slashCodeBlockIcon: React.ReactNode;
  slashDividerIcon: React.ReactNode;
  slashImageIcon: React.ReactNode;
  slashTableIcon: React.ReactNode;
  searchIcon: React.ReactNode;
  fallbackIcon: React.ReactNode;
  dragHandleIcon: React.ReactNode;
  boldIcon: React.ReactNode;
  italicIcon: React.ReactNode;
  underlineIcon: React.ReactNode;
  strikethroughIcon: React.ReactNode;
  codeIcon: React.ReactNode;
  alignLeftIcon: React.ReactNode;
  alignCenterIcon: React.ReactNode;
  alignRightIcon: React.ReactNode;
  linkIcon: React.ReactNode;
  unlinkIcon: React.ReactNode;
  checkIcon: React.ReactNode;
  copyIcon: React.ReactNode;
  deleteIcon: React.ReactNode;
  dropdownArrowIcon: React.ReactNode;
  codeBlockLanguageIcon: React.ReactNode;
  languageIcons: Record<string, React.ReactNode>;
}

const Svg = ({
  children,
  className,
  width = 24,
  height = 24,
  strokeWidth = 2,
}: {
  children: React.ReactNode;
  className?: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {children}
  </svg>
);

const LangIcon = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {children}
  </svg>
);

export const DEFAULT_LANGUAGE_ICONS: Record<string, React.ReactNode> = {
  bash: (
    <LangIcon>
      <rect x="2.5" y="4" width="19" height="16" rx="2" />
      <path d="M6.5 9.5l3.5 3-3.5 3" />
      <path d="M12 15.5h5.5" />
    </LangIcon>
  ),
  c: (
    <LangIcon>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15.6 9.3a4.5 4.5 0 1 0 0 5.4" />
    </LangIcon>
  ),
  cpp: (
    <LangIcon>
      <circle cx="9.5" cy="12" r="6.5" />
      <path d="M12.3 9.7a3.3 3.3 0 1 0 0 4.6" />
      <path d="M15.7 10.5v3M14.2 12h3" />
      <path d="M19.3 10.5v3M17.8 12h3" />
    </LangIcon>
  ),
  css: (
    <LangIcon>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M9.7 7.5l-1 9" />
      <path d="M15.3 7.5l-1 9" />
      <path d="M7 10.3h11" />
      <path d="M6.5 14.3h11" />
    </LangIcon>
  ),
  go: (
    <LangIcon>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M12.6 9.7A3.3 3.3 0 1 0 12.6 14.3" />
      <path d="M12.6 12h-1.9" />
      <circle cx="17" cy="12" r="2.9" />
    </LangIcon>
  ),
  html: (
    <LangIcon>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M9.5 8.5L6.5 12l3 3.5" />
      <path d="M14.5 8.5L17.5 12l-3 3.5" />
      <path d="M13 7.3l-2 9.4" />
    </LangIcon>
  ),
  java: (
    <LangIcon>
      <path d="M6 10h10v5a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-5z" />
      <path d="M16 12h1.3a1.8 1.8 0 0 1 0 3.6H16" />
      <path d="M9.3 3.8c-.9.8-.9 1.6 0 2.4M13.3 3.8c-.9.8-.9 1.6 0 2.4" />
      <path d="M6 19.3h10" />
    </LangIcon>
  ),
  javascript: (
    <LangIcon>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M10.5 8v6.5a2 2 0 0 1-3.5 1.3" />
      <path d="M17 8.8a2 2 0 0 0-2-.8c-1.1 0-2.2.6-2.2 1.7 0 1 .9 1.4 2.2 1.7 1.3.3 2.3.7 2.3 1.9 0 1.1-1 1.8-2.3 1.8a2.4 2.4 0 0 1-2.3-1.4" />
    </LangIcon>
  ),
  json: (
    <LangIcon>
      <path d="M8 3H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2" />
      <path d="M16 3h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2" />
    </LangIcon>
  ),
  kotlin: (
    <LangIcon>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M9 7.5v9" />
      <path d="M9 12l6-4.5" />
      <path d="M9 12l6 4.5" />
    </LangIcon>
  ),
  markdown: (
    <LangIcon>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M6 15V9l3 4 3-4v6" />
      <path d="M16.5 9v6" />
      <path d="M14.5 13l2 2 2-2" />
    </LangIcon>
  ),
  php: (
    <LangIcon>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M11.5 8.5L7.5 12l4 3.5" />
      <path d="M15.2 8.2c1.1 0 1.9.6 1.9 1.6 0 1.1-.9 1.5-1.8 1.8-.6.2-1 .5-1 1.1" />
      <circle cx="14.3" cy="16.2" r=".5" fill="currentColor" stroke="none" />
    </LangIcon>
  ),
  plaintext: (
    <LangIcon>
      <rect x="4" y="2.5" width="16" height="19" rx="2" />
      <line x1="7.5" y1="7.5" x2="16.5" y2="7.5" />
      <line x1="7.5" y1="11.5" x2="16.5" y2="11.5" />
      <line x1="7.5" y1="15.5" x2="13.5" y2="15.5" />
    </LangIcon>
  ),
  python: (
    <LangIcon>
      <path d="M4.5 15c0-3 2.5-4.7 5.7-4.7h1.6c2.8 0 5-2 5-4.5" />
      <path d="M9.5 3.3c1.3-.3 2.6 0 3.3 1-.7 1-2 1.3-3.3 1" />
      <circle cx="15.5" cy="4.3" r=".55" fill="currentColor" stroke="none" />
      <path d="M17.8 4.5l1.4-.6M17.8 4.9l1.4.6" />
    </LangIcon>
  ),
  ruby: (
    <LangIcon>
      <polygon points="12 2.5 19.5 8 12 21.5 4.5 8" />
      <path d="M4.5 8h15" />
      <path d="M12 2.5v19" />
    </LangIcon>
  ),
  rust: (
    <LangIcon>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2.3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
      <path d="M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </LangIcon>
  ),
  sql: (
    <LangIcon>
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
      <path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </LangIcon>
  ),
  swift: (
    <LangIcon>
      <path d="M19 4.5c-2.6 4-5.5 7-8.3 9 2-.2 3.7-1 4.8-2.6-.7 2.8-2.8 5-5.3 6.1 3 .5 5.6-.5 7.2-2.4.4 2-.4 3.9-1.9 4.9 3.7-1.3 6-4.2 6.6-7.6-1 2.6-2.8 4.6-4.6 5.8" />
    </LangIcon>
  ),
  typescript: (
    <LangIcon>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M7.3 8.2h5M9.8 8.2v7.6" />
      <path d="M17 8.8a2 2 0 0 0-2-.8c-1.1 0-2.2.6-2.2 1.7 0 1 .9 1.4 2.2 1.7 1.3.3 2.3.7 2.3 1.9 0 1.1-1 1.8-2.3 1.8a2.4 2.4 0 0 1-2.3-1.4" />
    </LangIcon>
  ),
  xml: (
    <LangIcon>
      <path d="M8 7l-4.5 5 4.5 5" />
      <path d="M16 7l4.5 5-4.5 5" />
      <path d="M12 8v8" />
    </LangIcon>
  ),
  yaml: (
    <LangIcon>
      <rect x="2.5" y="3" width="19" height="18" rx="2" />
      <path d="M6.5 8h2M9.5 8h8" />
      <path d="M6.5 12h2M9.5 12h6" />
      <path d="M6.5 16h2M9.5 16h7" />
    </LangIcon>
  ),
};

export const DEFAULT_ICONS: BlockEditorIcons = {
  alignCenterIcon: (
    <Svg>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="7" y1="12" x2="17" y2="12" />
      <line x1="5.5" y1="18" x2="18.5" y2="18" />
    </Svg>
  ),
  alignLeftIcon: (
    <Svg>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="14" y2="12" />
      <line x1="4" y1="18" x2="17" y2="18" />
    </Svg>
  ),
  alignRightIcon: (
    <Svg>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="10" y1="12" x2="20" y2="12" />
      <line x1="7" y1="18" x2="20" y2="18" />
    </Svg>
  ),
  boldIcon: (
    <Svg>
      <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
      <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
    </Svg>
  ),
  checkIcon: (
    <Svg>
      <polyline points="20 6 9 17 4 12" />
    </Svg>
  ),
  codeBlockLanguageIcon: (
    <Svg>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </Svg>
  ),
  codeIcon: (
    <Svg>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </Svg>
  ),
  copyIcon: (
    <Svg>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Svg>
  ),
  deleteIcon: (
    <Svg>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </Svg>
  ),
  dragHandleIcon: (
    <Svg className="block-editor-drag-handle-icon">
      <circle cx="9" cy="5" r="1" />
      <circle cx="15" cy="5" r="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="9" cy="19" r="1" />
      <circle cx="15" cy="19" r="1" />
    </Svg>
  ),
  dropdownArrowIcon: (
    <Svg width={12} height={12}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  ),
  fallbackIcon: (
    <Svg>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </Svg>
  ),
  italicIcon: (
    <Svg>
      <line x1="19" y1="4" x2="10" y2="4" />
      <line x1="14" y1="20" x2="5" y2="20" />
      <line x1="15" y1="4" x2="9" y2="20" />
    </Svg>
  ),
  languageIcons: DEFAULT_LANGUAGE_ICONS,
  linkIcon: (
    <Svg>
      <path d="M9 17H7a5 5 0 0 1 0-10h2" />
      <path d="M15 7h2a5 5 0 0 1 0 10h-2" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </Svg>
  ),
  searchIcon: (
    <Svg width={14} height={14} strokeWidth={1.5}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </Svg>
  ),
  slashBlockquoteIcon: (
    <Svg>
      <path d="M7 8a3 3 0 0 0-3 3v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H6a3 3 0 0 1 2-3" />
      <path d="M16 8a3 3 0 0 0-3 3v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1a3 3 0 0 1 2-3" />
    </Svg>
  ),
  slashBulletListIcon: (
    <Svg>
      <line x1="9" y1="6" x2="21" y2="6" />
      <line x1="9" y1="12" x2="21" y2="12" />
      <line x1="9" y1="18" x2="21" y2="18" />
      <circle cx="4" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="1.2" fill="currentColor" stroke="none" />
    </Svg>
  ),
  slashCodeBlockIcon: (
    <Svg>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </Svg>
  ),
  slashDividerIcon: (
    <Svg>
      <line x1="2" y1="12" x2="22" y2="12" />
    </Svg>
  ),
  slashHeadingIcon: (
    <Svg>
      <path d="M6 12h12" />
      <path d="M6 20V4" />
      <path d="M18 20V4" />
    </Svg>
  ),
  slashImageIcon: (
    <Svg>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </Svg>
  ),
  slashOrderedListIcon: (
    <Svg>
      <line x1="10" y1="6" x2="21" y2="6" />
      <line x1="10" y1="12" x2="21" y2="12" />
      <line x1="10" y1="18" x2="21" y2="18" />
      <path d="M4 5h2v4" />
      <path d="M4 9h2" />
      <path d="M4 13h2.5L4 16h2.5" />
      <path d="M4 19h2.5" />
    </Svg>
  ),
  slashTableIcon: (
    <Svg>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </Svg>
  ),
  slashTaskListIcon: (
    <Svg>
      <rect x="3" y="5" width="6" height="6" rx="1" />
      <path d="M5 8l1.5 1.5L9 6" />
      <line x1="12" y1="8" x2="21" y2="8" />
      <rect x="3" y="13" width="6" height="6" rx="1" />
      <line x1="12" y1="16" x2="21" y2="16" />
    </Svg>
  ),
  slashTextIcon: (
    <Svg>
      <path d="M4 7V4h16v3" />
      <path d="M9 20h6" />
      <path d="M12 4v16" />
    </Svg>
  ),
  strikethroughIcon: (
    <Svg>
      <path d="M16 4H9.5a3.5 3.5 0 0 0-2.9 5.4" />
      <path d="M14.5 14.6a3.5 3.5 0 0 1-2.9 5.4H8" />
      <line x1="4" y1="12" x2="20" y2="12" />
    </Svg>
  ),
  underlineIcon: (
    <Svg>
      <path d="M6 4v6a6 6 0 0 0 12 0V4" />
      <line x1="4" y1="20" x2="20" y2="20" />
    </Svg>
  ),
  unlinkIcon: (
    <Svg>
      <path d="M9 17H7a5 5 0 0 1-1.7-9.7" />
      <path d="M15 7h2a5 5 0 0 1 1.7 9.7" />
      <line x1="3" y1="3" x2="21" y2="21" />
    </Svg>
  ),
};
