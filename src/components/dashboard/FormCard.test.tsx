// @vitest-environment jsdom

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FormCard } from "./FormCard";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    search,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string;
    params: { formId: string };
    search?: { preview?: boolean };
    children: ReactNode;
  }) => {
    const path = to.replace("$formId", params.formId);
    const href = search?.preview ? `${path}?preview=true` : path;
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));

const publishedForm = {
  id: 17,
  publicId: "public-form",
  title: "Client intake",
  status: "published" as const,
  description: "Collect project details and deposits.",
  updatedAt: new Date(),
};

describe("FormCard", () => {
  afterEach(cleanup);

  it("connects every creator action to the form workspace", () => {
    render(
      <FormCard
        form={publishedForm}
        onDelete={vi.fn()}
        onShare={vi.fn()}
      />,
    );

    expect(
      screen
        .getByRole("link", { name: "Builder for Client intake" })
        .getAttribute("href"),
    ).toBe("/forms/17/edit");
    expect(
      screen
        .getByRole("link", { name: "Responses for Client intake" })
        .getAttribute("href"),
    ).toBe("/forms/17/submissions");
    expect(
      screen
        .getByRole("link", { name: "Payments for Client intake" })
        .getAttribute("href"),
    ).toBe("/forms/17/payments");
    expect(
      screen
        .getByRole("link", { name: "Invoicing for Client intake" })
        .getAttribute("href"),
    ).toBe("/forms/17/invoicing");
    expect(
      screen
        .getByRole("link", { name: "Preview Client intake" })
        .getAttribute("href"),
    ).toBe("/forms/17/edit?preview=true");
  });

  it("opens sharing for a published form", () => {
    const onShare = vi.fn();
    render(
      <FormCard
        form={publishedForm}
        onDelete={vi.fn()}
        onShare={onShare}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Share Client intake" }));
    expect(onShare).toHaveBeenCalledWith(17);
  });

  it("keeps Share visible but unavailable until a draft is published", () => {
    render(
      <FormCard
        form={{ ...publishedForm, status: "draft" }}
        onDelete={vi.fn()}
        onShare={vi.fn()}
      />,
    );

    const shareButton = screen.getByRole("button", {
      name: "Share Client intake — publish first",
    }) as HTMLButtonElement;
    expect(
      shareButton.disabled,
    ).toBe(true);
  });

  it("reports card selection changes", () => {
    const onSelectionChange = vi.fn();
    render(
      <FormCard
        form={publishedForm}
        onDelete={vi.fn()}
        onShare={vi.fn()}
        selected={false}
        onSelectionChange={onSelectionChange}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Select Client intake" }));
    expect(onSelectionChange).toHaveBeenCalledWith(17, true);
  });
});
