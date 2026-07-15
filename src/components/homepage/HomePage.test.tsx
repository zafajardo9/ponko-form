// @vitest-environment jsdom

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomePage } from "./HomePage";

const auth = vi.hoisted(() => ({ state: "signed-out" as "signed-in" | "signed-out" }));

vi.mock("@clerk/tanstack-react-start", () => ({
  Show: ({ when, children }: { when: "signed-in" | "signed-out"; children: ReactNode }) =>
    auth.state === when ? children : null,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

describe("HomePage", () => {
  afterEach(() => {
    cleanup();
    auth.state = "signed-out";
  });

  it("renders the signed-out marketing journey with working destinations", () => {
    render(<HomePage />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("link", { name: /start building free/i }).getAttribute("href")).toBe(
      "/sign-up/",
    );
    expect(screen.getByRole("link", { name: /see how it works/i }).getAttribute("href")).toBe(
      "#how-it-works",
    );
    expect(document.querySelector("#how-it-works")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /every transaction has a state/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "PayPal" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Xendit" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Resend" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Documentation" }).getAttribute("href")).toBe("/docs");

    for (const deadLabel of ["Pricing", "Help Center", "Privacy", "Terms", "Cookies"]) {
      expect(screen.queryByText(deadLabel)).toBeNull();
    }

    expect(screen.getByText("Illustrative dashboard").closest('[aria-hidden="true"]')).toBeTruthy();
  });

  it("uses authenticated form and integration destinations when signed in", () => {
    auth.state = "signed-in";
    render(<HomePage />);

    expect(screen.getAllByRole("link", { name: /go to my forms/i })[0].getAttribute("href")).toBe(
      "/forms",
    );
    expect(screen.getAllByRole("link", { name: /browse templates/i })[0].getAttribute("href")).toBe(
      "/forms/new",
    );
    expect(screen.getByRole("link", { name: /manage integrations/i }).getAttribute("href")).toBe(
      "/settings/integrations",
    );
    expect(screen.queryByRole("link", { name: /start building free/i })).toBeNull();
  });
});
