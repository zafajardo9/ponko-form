import { useMemo, useEffect, useRef } from "react";

const HIGHLIGHT_LANGUAGES = new Set([
  "bash",
  "javascript",
  "json",
  "python",
  "ruby",
  "typescript",
  "xml",
]);

/**
 * MarkdownRenderer
 *
 * Renders markdown content as styled HTML with:
 *   - highlight.js syntax highlighting for code blocks
 *   - Mermaid diagram rendering (loaded from CDN)
 *   - Beautiful tables, lists, blockquotes, headings
 *   - Copy buttons on code blocks
 *   - Heading anchor links
 */
interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mermaidInitRef = useRef(false);
  const html = useMemo(() => renderMarkdown(content), [content]);

  // Load highlighting only when the current page contains a supported grammar.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const hasSupportedCode = [...root.querySelectorAll(
      'pre code[class*="language-"]',
    )].some((element) => {
      const language = [...element.classList]
        .find((className) => className.startsWith("language-"))
        ?.slice("language-".length);
      return language ? HIGHLIGHT_LANGUAGES.has(language) : false;
    });
    if (!hasSupportedCode) return;

    let cancelled = false;
    void import("./syntax-highlighter")
      .then(async ({ highlightCodeBlocks }) => {
        if (cancelled) return;
        await highlightCodeBlocks(root);
      })
      .catch(() => {
        // The escaped source remains readable if a highlighting chunk cannot load.
      });
    return () => {
      cancelled = true;
    };
  }, [html]);

  // Load mermaid from CDN and render diagrams.
  useEffect(() => {
    if (!rootRef.current) return;
    const mermaidBlocks = rootRef.current.querySelectorAll(".mermaid");
    if (mermaidBlocks.length === 0) return;
    if (mermaidInitRef.current) return;
    mermaidInitRef.current = true;

    if (typeof window !== "undefined" && (window as any).mermaid) {
      (window as any).mermaid.run({ nodes: mermaidBlocks });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
    script.onload = () => {
      if (typeof window !== "undefined" && (window as any).mermaid) {
        (window as any).mermaid.initialize({
          startOnLoad: false,
          theme: "default",
          themeVariables: {
            primaryColor: "#cc785c",
            primaryBorderColor: "#a9583e",
            lineColor: "#8e8b82",
            secondaryColor: "#f5f0e8",
            tertiaryColor: "#faf9f5",
          },
        });
        (window as any).mermaid.run({ nodes: mermaidBlocks });
      }
    };
    document.head.appendChild(script);
  }, [html]);

  return (
    <div
      ref={rootRef}
      className="
        max-w-none text-[#3d3d3a]

        /* ── Headings ── */
        [&_h1]:mt-0 [&_h1]:mb-8 [&_h1]:border-b [&_h1]:border-[#e6dfd8] [&_h1]:pb-5
        [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-[#141413]
        [&_h2]:mt-14 [&_h2]:mb-5 [&_h2]:border-t [&_h2]:border-[#e6dfd8] [&_h2]:pt-10
        [&_h2]:text-[1.75rem] [&_h2]:font-semibold [&_h2]:leading-tight [&_h2]:tracking-tight [&_h2]:text-[#141413]
        [&_h3]:mt-10 [&_h3]:mb-4 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:leading-snug [&_h3]:tracking-tight [&_h3]:text-[#141413]
        [&_h4]:mt-8 [&_h4]:mb-3 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:uppercase [&_h4]:tracking-[0.12em] [&_h4]:text-[#766f66]

        /* ── Body text ── */
        [&_p]:my-5 [&_p]:text-[16px] [&_p]:leading-8 [&_p]:text-[#4f4b45]
        sm:[&_p]:text-[17px]

        /* ── Links ── */
        [&_a]:font-medium [&_a]:text-[#b95f43] [&_a]:underline [&_a]:decoration-[#ddb5a7]
        [&_a]:decoration-1 [&_a]:underline-offset-4 hover:[&_a]:text-[#8f432d] hover:[&_a]:decoration-[#b95f43]

        /* ── Strong / emphasis ── */
        [&_strong]:font-semibold [&_strong]:text-[#1d1c1a] [&_em]:text-[#57544d]

        /* ── Inline code ── */
        [&_code]:rounded-md [&_code]:border [&_code]:border-[#e3dbd0] [&_code]:bg-[#f5f0e8]
        [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.84em] [&_code]:font-normal [&_code]:text-[#77539a]

        /* ── Code blocks ── */
        [&_pre]:m-0 [&_pre]:overflow-visible [&_pre]:whitespace-normal [&_pre]:border-0 [&_pre]:bg-transparent [&_pre]:p-0 [&_pre]:shadow-none

        /* ── Blockquotes ── */
        [&_blockquote]:relative [&_blockquote]:my-8 [&_blockquote]:rounded-xl [&_blockquote]:border [&_blockquote]:border-[#e3d7ca]
        [&_blockquote]:border-l-4 [&_blockquote]:border-l-[#cc785c] [&_blockquote]:bg-[#fbf7f1]
        [&_blockquote]:px-5 [&_blockquote]:py-4 [&_blockquote]:text-[15px] [&_blockquote]:not-italic [&_blockquote]:leading-7 [&_blockquote]:text-[#57544d]

        /* ── Lists ── */
        [&_ol]:my-6 [&_ol]:list-decimal [&_ol]:space-y-2.5 [&_ol]:pl-7
        [&_ul]:my-6 [&_ul]:list-disc [&_ul]:space-y-2.5 [&_ul]:pl-7
        [&_li]:pl-1.5 [&_li]:text-[16px] [&_li]:leading-7 [&_li]:text-[#4f4b45] sm:[&_li]:text-[17px]
        [&_li::marker]:font-semibold [&_li::marker]:text-[#c5775d]

        /* ── Tables ── */
        prose-table:my-0 prose-table:w-full prose-table:border-collapse
        [&_.docs-table-wrap]:my-7 [&_.docs-table-wrap]:overflow-x-auto
        [&_.docs-table-wrap]:rounded-lg [&_.docs-table-wrap]:border [&_.docs-table-wrap]:border-[#d8d0c5]
        [&_.docs-table-wrap]:bg-white
        [&_.docs-table]:min-w-full [&_.docs-table]:text-sm
        [&_.docs-table_th]:border-r [&_.docs-table_th]:border-b [&_.docs-table_th]:border-[#d8d0c5]
        [&_.docs-table_th]:bg-[#efe9de] [&_.docs-table_th]:px-4 [&_.docs-table_th]:py-3
        [&_.docs-table_th]:text-left [&_.docs-table_th]:font-semibold [&_.docs-table_th]:text-[#141413]
        [&_.docs-table_th:last-child]:border-r-0
        [&_.docs-table_td]:border-r [&_.docs-table_td]:border-b [&_.docs-table_td]:border-[#e6dfd8]
        [&_.docs-table_td]:bg-white [&_.docs-table_td]:px-4 [&_.docs-table_td]:py-3
        [&_.docs-table_td]:align-top [&_.docs-table_td]:leading-relaxed [&_.docs-table_td]:text-[#3d3d3a]
        [&_.docs-table_td:last-child]:border-r-0
        [&_.docs-table_tr:nth-child(even)_td]:bg-[#faf9f5]
        [&_.docs-table_tr:last-child_td]:border-b-0

        /* ── Images ── */
        [&_img]:my-9 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xl [&_img]:border [&_img]:border-[#e6dfd8] [&_img]:shadow-sm

        /* ── Horizontal rules ── */
        [&_hr]:my-12 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-[#e6dfd8]
        [&_hr+h2]:border-t-0 [&_hr+h2]:pt-0

        /* ── Code samples ── */
        [&_.code-block]:my-7 [&_.code-block]:overflow-hidden [&_.code-block]:rounded-lg
        [&_.code-block]:border [&_.code-block]:border-[#252320] [&_.code-block]:bg-[#181715]
        [&_.code-header]:flex [&_.code-header]:items-center [&_.code-header]:justify-between
        [&_.code-header]:gap-3 [&_.code-header]:border-b [&_.code-header]:border-[#34312c]
        [&_.code-header]:bg-[#252320] [&_.code-header]:px-4 [&_.code-header]:py-2.5
        [&_.code-title]:flex [&_.code-title]:min-w-0 [&_.code-title]:items-center [&_.code-title]:gap-2
        [&_.code-dot]:h-2.5 [&_.code-dot]:w-2.5 [&_.code-dot]:rounded-full
        [&_.code-lang]:truncate [&_.code-lang]:font-mono [&_.code-lang]:text-[11px]
        [&_.code-lang]:font-medium [&_.code-lang]:uppercase [&_.code-lang]:tracking-wide [&_.code-lang]:text-[#a09d96]
        [&_.code-copy]:shrink-0 [&_.code-copy]:rounded-md [&_.code-copy]:border [&_.code-copy]:border-[#474139]
        [&_.code-copy]:bg-[#181715] [&_.code-copy]:px-2.5 [&_.code-copy]:py-1.5
        [&_.code-copy]:text-xs [&_.code-copy]:font-medium [&_.code-copy]:text-[#faf9f5]
        [&_.code-copy]:transition-colors hover:[&_.code-copy]:border-[#cc785c] hover:[&_.code-copy]:text-[#cc785c]
        [&_.code-body]:bg-[#181715]
        [&_.code-pre]:!m-0 [&_.code-pre]:overflow-x-auto [&_.code-pre]:!bg-transparent
        [&_.code-pre]:!p-4 [&_.code-pre]:font-mono [&_.code-pre]:text-[13px] [&_.code-pre]:leading-6
        [&_.code-pre]:text-[#f5f0e8]
        [&_.code-pre_code]:!border-0 [&_.code-pre_code]:!bg-transparent [&_.code-pre_code]:!p-0 [&_.code-pre_code]:!font-inherit
        [&_.code-pre_code]:!text-inherit

        /* ── Heading scroll margins ── */
        [&_h2]:scroll-mt-24 [&_h3]:scroll-mt-24 [&_h4]:scroll-mt-24

        /* ── Heading anchor links ── */
        [&_.heading-anchor]:ml-2 [&_.heading-anchor]:opacity-0
        [&_.heading-anchor]:text-[#cc785c] [&_.heading-anchor]:no-underline
        [&_.heading-anchor]:text-sm [&_.heading-anchor]:font-normal
        hover:[&_.heading-anchor]:opacity-100
        [&_h2:hover_.heading-anchor]:opacity-100
        [&_h3:hover_.heading-anchor]:opacity-100

        /* ── Mermaid diagrams ── */
        [&_.mermaid]:my-8 [&_.mermaid]:p-6 [&_.mermaid]:bg-[#faf9f5] [&_.mermaid]:rounded-lg
        [&_.mermaid]:border [&_.mermaid]:border-[#e6dfd8] [&_.mermaid]:overflow-x-auto
        [&_.mermaid]:shadow-sm

        /* ── Blockquote strong text ── */
        [&_blockquote_strong]:text-[#141413]

        /* ── First and last element rhythm ── */
        [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
      "
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function renderMarkdown(md: string): string {
  const lines = md.split("\n");
  const html: string[] = [];
  let i = 0;
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeLang = "";
  let inTable = false;
  let tableBuffer: string[] = [];
  let skippedFirstH1 = false;

  while (i < lines.length) {
    const line = lines[i];

    // ── Fenced code blocks ──
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        const code = codeBuffer.join("\n");
        if (codeLang === "mermaid") {
          html.push(`<div class="mermaid">${escapeHtml(code)}</div>`);
        } else {
          html.push(renderCodeBlock(code, codeLang));
        }
        codeBuffer = [];
        inCodeBlock = false;
        codeLang = "";
        i++;
        continue;
      }
      inCodeBlock = true;
      codeLang = normalizeLang(line.trim().slice(3).trim());
      i++;
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      i++;
      continue;
    }

    // ── Tables ──
    if (line.trim().startsWith("|")) {
      tableBuffer.push(line);
      inTable = true;
      i++;
      continue;
    }
    if (inTable) {
      html.push(renderTable(tableBuffer));
      tableBuffer = [];
      inTable = false;
      continue;
    }

    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // ── Horizontal rule ──
    if (/^---$/.test(trimmed) || /^\*\*\*$/.test(trimmed)) {
      if (trimmed.length >= 3) {
        html.push("<hr />");
      }
      i++;
      continue;
    }

    // ── Headings ──
    const hMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (hMatch) {
      const level = hMatch[1].length;
      const text = hMatch[2];
      if (level === 1 && !skippedFirstH1) {
        skippedFirstH1 = true;
        i++;
        continue;
      }
      const id = slugify(text);
      const anchor = `<a href="#${id}" class="heading-anchor">#</a>`;
      html.push(
        `<h${level} id="${id}">${renderInline(text)}${anchor}</h${level}>`,
      );
      i++;
      continue;
    }

    // ── Blockquotes ──
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      html.push(
        `<blockquote>${renderInline(quoteLines.join("<br/>"))}</blockquote>`,
      );
      continue;
    }

    // ── Unordered list ──
    if (trimmed.match(/^[-*+]\s/)) {
      const listItems: string[] = [];
      while (i < lines.length && lines[i].trim().match(/^[-*+]\s/)) {
        listItems.push(
          `<li>${renderInline(lines[i].trim().replace(/^[-*+]\s+/, ""))}</li>`,
        );
        i++;
      }
      html.push(`<ul>${listItems.join("")}</ul>`);
      continue;
    }

    // ── Ordered list ──
    if (trimmed.match(/^\d+\.\s/)) {
      const listItems: string[] = [];
      while (i < lines.length && lines[i].trim().match(/^\d+\.\s/)) {
        listItems.push(
          `<li>${renderInline(lines[i].trim().replace(/^\d+\.\s+/, ""))}</li>`,
        );
        i++;
      }
      html.push(`<ol>${listItems.join("")}</ol>`);
      continue;
    }

    // ── Paragraph ──
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("#") &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].trim().startsWith("|") &&
      !lines[i].trim().startsWith(">") &&
      !lines[i].trim().match(/^[-*+]\s/) &&
      !lines[i].trim().match(/^\d+\.\s/) &&
      !/^-{3,}$/.test(lines[i].trim()) &&
      !/^\*{3,}$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    if (paraLines.length > 0) {
      html.push(`<p>${renderInline(paraLines.join(" "))}</p>`);
    }
  }

  // Flush remaining
  if (inTable && tableBuffer.length > 0) html.push(renderTable(tableBuffer));
  if (inCodeBlock && codeBuffer.length > 0) {
    const code = codeBuffer.join("\n");
    if (codeLang === "mermaid") {
      html.push(`<div class="mermaid">${escapeHtml(code)}</div>`);
    } else {
      html.push(renderCodeBlock(code, codeLang));
    }
  }

  return html.join("\n");
}

/** Render a fenced code block with a stylized header and copy button. */
function renderCodeBlock(code: string, lang: string): string {
  const escaped = escapeHtml(code);
  const langLabel = lang || "text";
  const langDisplay = langLabel === "plaintext" ? "text" : langLabel;
  const encodedForData = encodeURIComponent(code);
  return `
<div class="code-block">
  <div class="code-header">
    <span class="code-title">
      <span class="code-dot bg-[#c64545]"></span>
      <span class="code-dot bg-[#d4a017]"></span>
      <span class="code-dot bg-[#5db872]"></span>
      <span class="code-lang">${escapeHtml(langDisplay)}</span>
    </span>
    <button
      onclick="(function(btn){
        var c = decodeURIComponent(btn.getAttribute('data-code') || '');
        navigator.clipboard.writeText(c);
        btn.textContent='Copied!';
        setTimeout(function(){btn.textContent='Copy'},2000);
      })(this)"
      data-code="${encodedForData}"
      class="code-copy"
    >Copy</button>
  </div>
  <div class="code-body">
    <pre class="code-pre"><code class="language-${langLabel}">${escaped}</code></pre>
  </div>
</div>`;
}

function renderInline(text: string): string {
  // Images must be parsed before links because their syntax overlaps.
  text = text.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (_match, alt: string, src: string) =>
      `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" />`,
  );
  // Inline code (do first to avoid interfering with other markers).
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
  // Bold
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // Italic
  text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  // Links
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
    const resolvedHref = resolveDocHref(href);
    const isExternal = /^https?:\/\//i.test(resolvedHref);
    const externalAttrs = isExternal
      ? ' target="_blank" rel="noopener noreferrer"'
      : "";
    return `<a href="${escapeHtml(resolvedHref)}"${externalAttrs}>${label}</a>`;
  });
  return text;
}

/** Turn familiar Markdown file links into working links inside the docs app. */
function resolveDocHref(href: string): string {
  const match = href.match(/^(?:\.\/)?([^/#]+)\.md(#[^\s]+)?$/i);
  if (!match) return href;
  return `/docs/${match[1]}${match[2] ?? ""}`;
}

function renderTable(rows: string[]): string {
  if (rows.length < 2) return "";

  const headerCells = parseTableRow(rows[0]);
  const hasSep = rows.length > 1 && /^\|[-:| ]+\|$/.test(rows[1].trim());
  const bodyRows = hasSep ? rows.slice(2) : rows.slice(1);

  let table = '<div class="docs-table-wrap"><table class="docs-table"><thead><tr>';
  for (const cell of headerCells) {
    table += `<th>${renderInline(cell)}</th>`;
  }
  table += "</tr></thead><tbody>";

  for (const row of bodyRows) {
    const trimmed = row.trim();
    if (!trimmed.startsWith("|")) continue;
    const cells = parseTableRow(trimmed);
    if (cells.length === 0) continue;
    table += "<tr>";
    for (const cell of cells) {
      table += `<td>${renderInline(cell)}</td>`;
    }
    table += "</tr>";
  }

  table += "</tbody></table></div>";
  return table;
}

function parseTableRow(row: string): string[] {
  const trimmed = row.trim();
  const inner = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  return inner.split("|").map((c) => c.trim());
}

/** Normalize code language identifiers for highlight.js. */
function normalizeLang(lang: string): string {
  const map: Record<string, string> = {
    jsonc: "json",
    text: "plaintext",
    js: "javascript",
    ts: "typescript",
    py: "python",
    rb: "ruby",
    sh: "bash",
    zsh: "bash",
    html: "xml",
  };
  return map[lang] || lang;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
