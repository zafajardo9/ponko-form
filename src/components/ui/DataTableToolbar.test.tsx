// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DataTableColumn } from "./DataTableTypes";
import { DataTableToolbar } from "./DataTableToolbar";

interface Row {
  status: string;
  amount: number;
}

const columns: DataTableColumn<Row>[] = [
  {
    key: "status",
    header: "Status",
    accessor: (row) => row.status,
    filterable: true,
    filterType: "select",
    filterOptions: [{ label: "Completed", value: "completed" }],
  },
  {
    key: "amount",
    header: "Amount",
    accessor: (row) => row.amount,
    filterable: true,
    filterType: "number-range",
  },
];

afterEach(cleanup);

function renderToolbar(onFilterChange = vi.fn()) {
  render(
    <DataTableToolbar
      searchValue=""
      onSearchChange={vi.fn()}
      columns={columns}
      visibleColumns={new Set(["status", "amount"])}
      onToggleColumn={vi.fn()}
      onResetColumns={vi.fn()}
      activeFilters={{}}
      onFilterChange={onFilterChange}
      onClearAllFilters={vi.fn()}
    />,
  );
}

describe("DataTableToolbar", () => {
  it("lets the user choose any filterable column", () => {
    renderToolbar();

    fireEvent.click(screen.getByRole("button", { name: "Filters" }));

    expect(screen.getByRole("menuitem", { name: "Status" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Amount" })).toBeTruthy();
  });

  it("applies a number range", () => {
    const onFilterChange = vi.fn();
    renderToolbar(onFilterChange);

    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Amount" }));
    fireEvent.change(screen.getByLabelText("Minimum"), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByLabelText("Maximum"), {
      target: { value: "20" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(onFilterChange).toHaveBeenCalledWith("amount", {
      min: 10,
      max: 20,
    });
  });
});
