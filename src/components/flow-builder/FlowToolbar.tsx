import { Button } from '../ui/Button'

/**
 * FlowToolbar
 *
 * Action bar above the canvas. Most edits auto-save (config on blur, positions
 * on drag-stop), so "Save now" simply flushes positions and confirms. Validate
 * toggles the error list, Preview opens the test-run panel, Variables toggles
 * the variables manager, and Auto-layout tidies node positions.
 */
interface FlowToolbarProps {
  errorCount: number
  validateOpen: boolean
  previewing: boolean
  saving: boolean
  saved: boolean
  onSave: () => void
  onToggleValidate: () => void
  onTogglePreview: () => void
  onToggleVariables: () => void
  onAutoLayout: () => void
}

export function FlowToolbar({
  errorCount,
  validateOpen,
  previewing,
  saving,
  saved,
  onSave,
  onToggleValidate,
  onTogglePreview,
  onToggleVariables,
  onAutoLayout,
}: FlowToolbarProps) {
  return (
    <div className="flex items-center gap-2 border-b border-[#e6dfd8] bg-[#faf9f5] px-4 py-2">
      <Button variant="secondary" size="sm" onClick={onSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save now'}
      </Button>
      {saved && !saving && <span className="text-xs text-[#2f7d52]">All changes saved</span>}

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onToggleValidate}
          className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${
            errorCount > 0
              ? 'border-[#c64545] text-[#c64545] hover:bg-[#fbeaea]'
              : 'border-[#e6dfd8] text-[#2f7d52] hover:bg-[#eef6f0]'
          } ${validateOpen ? 'ring-2 ring-[#cc785c]/30' : ''}`}
        >
          {errorCount > 0 ? `${errorCount} issue${errorCount > 1 ? 's' : ''}` : 'Valid ✓'}
        </button>
        <Button variant="secondary" size="sm" onClick={onAutoLayout}>
          Auto-layout
        </Button>
        <Button variant="secondary" size="sm" onClick={onToggleVariables}>
          Variables
        </Button>
        <Button variant={previewing ? 'primary' : 'primary'} size="sm" onClick={onTogglePreview}>
          {previewing ? 'Close preview' : 'Preview'}
        </Button>
      </div>
    </div>
  )
}
