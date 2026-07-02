import { Button } from '../ui/Button'

/**
 * FlowToolbar
 *
 * Action bar shown above the builder in BOTH List and Canvas views. Most edits
 * auto-save (config on blur, positions on drag-stop, list reorder), so "Save
 * now" simply flushes and confirms. Validate toggles the error list, Variables
 * toggles the variables manager, and Auto-layout (Canvas only) tidies node
 * positions. Preview lives in the page header, so it is intentionally not here.
 */
interface FlowToolbarProps {
  errorCount: number
  validateOpen: boolean
  variablesOpen: boolean
  saving: boolean
  saved: boolean
  onSave: () => void
  onToggleValidate: () => void
  onToggleVariables: () => void
  /** Canvas-only: auto-layout has no meaning in the List view. */
  onAutoLayout?: () => void
}

export function FlowToolbar({
  errorCount,
  validateOpen,
  variablesOpen,
  saving,
  saved,
  onSave,
  onToggleValidate,
  onToggleVariables,
  onAutoLayout,
}: FlowToolbarProps) {
  return (
    <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save now'}
        </Button>
        {saved && !saving && <span className="text-xs text-[#2f7d52]">All changes saved</span>}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:ml-auto sm:pb-0">
        <button
          onClick={onToggleValidate}
          className={`flex h-8 flex-none items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${
            errorCount > 0
              ? 'border-[#c64545] text-[#c64545] hover:bg-[#fbeaea]'
              : 'border-[#e6dfd8] text-[#2f7d52] hover:bg-[#eef6f0]'
          } ${validateOpen ? 'ring-2 ring-[#cc785c]/30' : ''}`}
        >
          {errorCount > 0 ? `${errorCount} issue${errorCount > 1 ? 's' : ''}` : 'Valid ✓'}
        </button>
        {onAutoLayout && (
          <Button variant="secondary" size="sm" onClick={onAutoLayout}>
            Auto-layout
          </Button>
        )}
        <Button
          variant={variablesOpen ? 'primary' : 'secondary'}
          size="sm"
          onClick={onToggleVariables}
        >
          Variables
        </Button>
      </div>
    </div>
  )
}
