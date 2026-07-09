interface DataTableEmptyProps {
  message?: string
}

export function DataTableEmpty({ message = "No results found." }: DataTableEmptyProps) {
  return (
    <div className="rounded-xl border border-dashed border-[#e6dfd8] py-24 text-center">
      <p className="text-[#8e8b82]">{message}</p>
    </div>
  )
}
