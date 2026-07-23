// @vitest-environment jsdom

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarkdownRenderer } from "./MarkdownRenderer";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("MarkdownRenderer syntax highlighting", () => {
  it("renders pages without code blocks without highlighting work", () => {
    const { container } = render(
      <MarkdownRenderer content={"# Guide\n\nA plain documentation page."} />,
    );

    expect(container.textContent).toContain("A plain documentation page.");
    expect(container.querySelector("code")).toBeNull();
    expect(container.querySelector("[data-highlighted='yes']")).toBeNull();
  });

  it("highlights the TypeScript, Bash, and JSON aliases used by the docs", async () => {
    const { container } = render(
      <MarkdownRenderer
        content={[
          "```typescript",
          "const answer: number = 42",
          "```",
          "```bash",
          "pnpm test",
          "```",
          "```jsonc",
          '{"enabled": true}',
          "```",
        ].join("\n")}
      />,
    );

    await waitFor(() => {
      expect(
        container.querySelectorAll("code[data-highlighted='yes']").length,
      ).toBe(3);
    });
    expect(container.querySelector(".language-typescript .hljs-keyword")).toBeTruthy();
    expect(container.querySelector(".language-bash .hljs-built_in")).toBeTruthy();
    expect(container.querySelector(".language-json .hljs-attr")).toBeTruthy();
  });

  it("leaves unknown and plaintext fences readable without highlighter warnings", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { container } = render(
      <MarkdownRenderer
        content={[
          "```custom-language",
          "some readable content",
          "```",
          "```text",
          "plain content",
          "```",
        ].join("\n")}
      />,
    );

    expect(container.querySelector(".language-custom-language")?.textContent).toBe(
      "some readable content",
    );
    expect(container.querySelector(".language-plaintext")?.textContent).toBe(
      "plain content",
    );
    expect(container.querySelector("[data-highlighted='yes']")).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });
});
