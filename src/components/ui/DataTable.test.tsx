// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataTable } from "./DataTable";
import type { DataTableColumn } from "./DataTableTypes";

interface Row {
  id: number;
  name: string;
}

const rows: Row[] = [
  { id: 1, name: "First response" },
  { id: 2, name: "Second response" },
];

const columns: DataTableColumn<Row>[] = [
  {
    key: "name",
    header: "Name",
    accessor: (row) => row.name,
  },
];

afterEach(cleanup);

describe("DataTable selection", () => {
  it("uses accessible custom checkboxes and passes selected rows to bulk actions", () => {
    const deleteSelected = vi.fn();

    render(
      <DataTable
        columns={columns}
        data={rows}
        keyField="id"
        selectionLabel="response"
        bulkActions={[
          {
            label: "Delete",
            tone: "danger",
            action: deleteSelected,
          },
        ]}
      />,
    );

    const firstRowCheckbox = screen.getByRole("checkbox", {
      name: "Select response 1",
    });
    fireEvent.click(firstRowCheckbox);

    expect(firstRowCheckbox.getAttribute("aria-checked")).toBe("true");
    expect(
      screen.getByText("1 response selected", { exact: true }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(deleteSelected).toHaveBeenCalledWith([rows[0]]);
  });

  it("selects the page and lets the user clear the selection", () => {
    render(
      <DataTable
        columns={columns}
        data={rows}
        keyField="id"
        selectionLabel="response"
        bulkActions={[{ label: "Archive", action: vi.fn() }]}
      />,
    );

    const selectAll = screen.getByRole("checkbox", {
      name: "Select all responses on this page",
    });
    fireEvent.click(selectAll);

    expect(selectAll.getAttribute("aria-checked")).toBe("true");
    expect(
      screen.getByText("2 responses selected", { exact: true }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Clear response selection" }),
    );
    expect(selectAll.getAttribute("aria-checked")).toBe("false");
  });
});

describe("DataTable client pagination", () => {
  const paginatedRows = Array.from({ length: 12 }, (_, index) => ({
    id: index + 1,
    name: `Discount ${index + 1}`,
  }));

  function SearchableTable() {
    const [search, setSearch] = useState("");
    const filteredRows = paginatedRows.filter((row) =>
      row.name.toLowerCase().includes(search.toLowerCase()),
    );

    return (
      <DataTable
        columns={columns}
        data={filteredRows}
        keyField="id"
        pageSize={10}
        searchValue={search}
        onSearchChange={setSearch}
      />
    );
  }

  it("paginates locally and resets to the first page when search changes", () => {
    render(<SearchableTable />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Discount 11")).toBeTruthy();
    expect(screen.queryByText("Discount 1")).toBeNull();

    fireEvent.change(screen.getByPlaceholderText("Search all fields..."), {
      target: { value: "Discount 1" },
    });

    expect(screen.getByText("Discount 1")).toBeTruthy();
    expect(screen.getByText("Page 1 of 1")).toBeTruthy();
  });
});
