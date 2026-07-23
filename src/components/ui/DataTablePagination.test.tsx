// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataTablePagination } from "./DataTablePagination";

afterEach(cleanup);

describe("DataTablePagination", () => {
  it("uses the total count to render the current range and page controls", () => {
    const onPageChange = vi.fn();

    render(
      <DataTablePagination
        page={2}
        pageSize={25}
        totalCount={61}
        onPageChange={onPageChange}
      />,
    );

    expect(screen.getByText("26–50 of 61")).toBeTruthy();
    expect(screen.getByText("Page 2 of 3")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("reports page-size changes to server-driven tables", () => {
    const onPageSizeChange = vi.fn();

    render(
      <DataTablePagination
        page={1}
        pageSize={25}
        totalCount={100}
        onPageChange={vi.fn()}
        onPageSizeChange={onPageSizeChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Rows per page"), {
      target: { value: "50" },
    });
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });
});
