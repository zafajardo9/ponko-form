import { useMemo, useEffect, useRef } from "react";
import hljs from "highlight.js";

/**
 * MarkdownRenderer
 *
 * Renders markdown content as styled HTML with:
 *   - highlight.js syntax highlighting for code blocks
 *   - Mermaid diagram rendering (loaded from CDN)
 *   - Tables, lists, blockquotes, headings, inline formatting
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

  // Apply highlight.js to code blocks after render.
  useEffect(() => {
    if (!rootRef.current) return;
    rootRef.current
      .querySelectorAll('pre code[class*="language-"]')
      .forEach((el) => {
        hljs.highlightElement(el as HTMLElement);
      });
  }, [html]);

  // Load mermaid from CDN and render diagrams.
  useEffect(() => {
    if (!rootRef.current) return;
    const mermaidBlocks = rootRef.current.querySelectorAll(".mermaid");
    if (mermaidBlocks.length === 0) return;
    if (mermaidInitRef.current) return;
    mermaidInitRef.current = true;

    // Check if mermaid is already loaded globally
    if (typeof window !== "undefined" && (window as any).mermaid) {
      (window as any).mermaid.run({ nodes: mermaidBlocks });
      return;
    }

    // Load mermaid from CDN
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
      className="prose prose-sm max-w-none
        prose-headings:font-semibold prose-headings:text-[#141413] prose-headings:tracking-tight
        prose-h1:text-2xl prose-h1:mt-0 prose-h1:mb-6 prose-h1:pb-3 prose-h1:border-b prose-h1:border-[#e6dfd8]
        prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-[#e6dfd8]/60
        prose-h3:text-base prose-h3:mt-7 prose-h3:mb-2
        prose-h4:text-sm prose-h4:mt-6 prose-h4:mb-2 prose-h4:uppercase prose-h4:tracking-wider prose-h4:text-[#8e8b82]
        prose-p:text-[#3d3d3a] prose-p:leading-relaxed prose-p:my-3
        prose-a:text-[#cc785c] prose-a:no-underline prose-a:font-medium hover:prose-a:text-[#a9583e] hover:prose-a:underline
        prose-strong:text-[#141413] prose-strong:font-semibold
        prose-code:text-sm prose-code:font-normal
        prose-code:bg-[#f5f0e8] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-[#6b46a8]
        prose-pre:bg-[#1a1a2e] prose-pre:text-[#e4e4e7] prose-pre:rounded-xl prose-pre:border prose-pre:border-[#2a2a3e]
        prose-pre:shadow-lg prose-pre:my-4 prose-pre:text-sm prose-pre:leading-relaxed
        prose-blockquote:border-l-4 prose-blockquote:border-[#cc785c] prose-blockquote:bg-[#faf9f5] prose-blockquote:rounded-r-lg
        prose-blockquote:px-5 prose-blockquote:py-3 prose-blockquote:my-4 prose-blockquote:text-[#57544d] prose-blockquote:italic
        prose-ol:pl-6 prose-ol:my-3 prose-ul:pl-6 prose-ul:my-3
        prose-li:my-1 prose-li:text-[#3d3d3a]
        prose-li:marker:text-[#cc785c]
        prose-table:w-full prose-table:my-6
        prose-table:border-collapse prose-table:rounded-lg prose-table:overflow-hidden
        prose-table:border prose-table:border-[#e6dfd8]
        prose-th:bg-[#f5f0e8] prose-th:px-4 prose-th:py-2.5 prose-th:text-sm prose-th:font-semibold prose-th:text-[#141413] prose-th:text-left
        prose-td:px-4 prose-td:py-2.5 prose-td:text-sm prose-td:text-[#3d3d3a]
        prose-td:border-t prose-td:border-[#e6dfd8]
        prose-tr:even:bg-[#faf9f5]
        prose-img:rounded-xl prose-img:shadow-sm prose-img:my-6
        prose-hr:border-[#e6dfd8] prose-hr:my-8
        [&_code]:before:content-none [&_code]:after:content-none
        [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-inherit
        [&_pre_code]:text-sm [&_pre_code]:leading-relaxed
        [&_pre]:relative
        [&_.code-header]:flex [&_.code-header]:items-center [&_.code-header]:justify-between
        [&_.code-header]:px-4 [&_.code-header]:py-2 [&_.code-header]:bg-[#252540]
        [&_.code-header]:rounded-t-xl [&_.code-header]:border-b [&_.code-header]:border-[#2a2a3e]
        [&_.code-header]:text-xs [&_.code-header]:text-[#8e8b82] [&_.code-header]:font-medium
        [&_.code-body]:px-4 [&_.code-body]:py-3 [&_.code-body]:overflow-x-auto
        [&_h2]:scroll-mt-24 [&_h3]:scroll-mt-24
        [&_.heading-anchor]:opacity-0 [&_.heading-anchor]:ml-1.5 [&_.heading-anchor]:text-[#cc785c] [&_.heading-anchor]:no-underline
        [&_.heading-anchor]:text-sm [&_.heading-anchor]:font-normal
        hover:[&_.heading-anchor]:opacity-100
        [&_h2:hover_.heading-anchor]:opacity-100
        [&_h3:hover_.heading-anchor]:opacity-100
        [&_.mermaid]:my-6 [&_.mermaid]:p-4 [&_.mermaid]:bg-white [&_.mermaid]:rounded-xl
        [&_.mermaid]:border [&_.mermaid]:border-[#e6dfd8] [&_.mermaid]:overflow-x-auto"
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

  while (i < lines.length) {
    const line = lines[i];

    // ── Fenced code blocks ──
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        // Close code block
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
      // Open code block
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
      // Make sure it's not a heading underline (has at least 3 dashes alone)
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

/** Render a fenced code block with a language header and a copy button. */
function renderCodeBlock(code: string, lang: string): string {
  const escaped = escapeHtml(code);
  const langLabel = lang || "text";
  const escapedForData = escapeAttr(code);
  return `
<pre class="!p-0 !bg-transparent !border-none !shadow-none">
  <div class="code-header">
    <span>${escapeHtml(langLabel)}</span>
    <button
      onclick="(function(btn){
        var c = btn.getAttribute('data-code');
        navigator.clipboard.writeText(c);
        btn.textContent='Copied!';
        setTimeout(function(){btn.textContent='Copy'},2000);
      })(this)"
      data-code="${escapedForData}"
      class="text-[#8e8b82] hover:text-white transition-colors cursor-pointer bg-transparent border-none text-xs"
    >Copy</button>
  </div>
  <div class="code-body">
    <code class="language-${langLabel}">${escaped}</code>
  </div>
</pre>`;
}

function renderInline(text: string): string {
  // Escape HTML entities first so that < and > in code samples render correctly
  // Inline code (do first to avoid interfering with other markers)
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
  // Bold
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // Italic
  text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  // Links
  text = text.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>',
  );
  // Images
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
  return text;
}

function renderTable(rows: string[]): string {
  if (rows.length < 2) return "";

  // Find the header row and separator row
  // The first row is always the header, second is the separator
  const headerCells = parseTableRow(rows[0]);
  // Determine if there's a separator (starts and ends with |, contains dashes)
  const hasSep = rows.length > 1 && /^\|[-:| ]+\|$/.test(rows[1].trim());
  const bodyRows = hasSep ? rows.slice(2) : rows.slice(1);

  let table = '<div class="overflow-x-auto"><table><thead><tr>';
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
  // Remove leading and trailing pipe, then split
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

function escapeAttr(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "\\n");
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
