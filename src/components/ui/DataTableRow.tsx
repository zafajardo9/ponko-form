import type { ReactNode } from "react"

interface DataTableRowProps {
  children: ReactNode
  onClick?: () => void
  selected?: boolean
}

export function DataTableRow({ children, onClick, selected }: DataTableRowProps) {
  return (
    <tr
      className={`transition-colors ${
        selected
          ? "bg-[#fff7f3] shadow-[inset_3px_0_0_#cc785c]"
          : onClick
            ? "cursor-pointer hover:bg-[#f5f0e8]"
            : ""
      }`}
      onClick={onClick}
    >
      {children}
    </tr>
  )
}
