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
          ? "bg-[#efe9de]"
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
