import type { FlowNodeType } from "../../lib/flow-engine/types";
import { FLOW_DND_MIME } from "./FlowPalette";
import {
  Type,
  AtSign,
  Hash,
  AlignJustify,
  ChevronDown,
  CheckSquare,
  CircleDot,
  LayoutGrid,
  Diamond,
  Sigma,
  DollarSign,
  Menu,
  ExternalLink,
  Calendar,
  Clock,
  CalendarClock,
} from "lucide-react";

/**
 * BuilderPalette
 *
 * Unified left palette for the form editor. Combines the form builder's field
 * types (which add a `form_field` node preset to that type) with the flow's
 * logic nodes (decision/calculator/payment/summary/redirect + field group).
 *
 * - Click → add to the primary path (List view convenience).
 * - Drag onto the Canvas → the canvas reads the node type from dataTransfer.
 *   Field items drop a `form_field`; the creator picks the field type after.
 */

const FIELD_ITEMS: {
  fieldType: string;
  label: string;
  icon: React.ReactNode;
}[] = [
  { fieldType: "text", label: "Text", icon: <Type size={14} /> },
  { fieldType: "email", label: "Email", icon: <AtSign size={14} /> },
  { fieldType: "number", label: "Number", icon: <Hash size={14} /> },
  {
    fieldType: "textarea",
    label: "Long Text",
    icon: <AlignJustify size={14} />,
  },
  { fieldType: "select", label: "Dropdown", icon: <ChevronDown size={14} /> },
  {
    fieldType: "checkbox",
    label: "Checkboxes",
    icon: <CheckSquare size={14} />,
  },
  { fieldType: "radio", label: "Radio", icon: <CircleDot size={14} /> },
  { fieldType: "date", label: "Date", icon: <Calendar size={14} /> },
  { fieldType: "time", label: "Time", icon: <Clock size={14} /> },
  { fieldType: "datetime", label: "Date & Time", icon: <CalendarClock size={14} /> },
];

const LOGIC_ITEMS: {
  type: Exclude<FlowNodeType, "start" | "form_field">;
  label: string;
  icon: React.ReactNode;
  accent: string;
  description: string;
}[] = [
  {
    type: "group",
    label: "Field Group",
    icon: <LayoutGrid size={14} />,
    accent: "bg-[#f3e3da] text-[#a9583e]",
    description: "Several fields on one step",
  },
  {
    type: "decision",
    label: "Decision",
    icon: <Diamond size={14} />,
    accent: "bg-[#f7ecd0] text-[#9e7424]",
    description: "Branch on a variable value",
  },
  {
    type: "calculator",
    label: "Calculator",
    icon: <Sigma size={14} />,
    accent: "bg-[#e7ddf7] text-[#6b46a8]",
    description: "Compute a value from an expression",
  },
  {
    type: "payment",
    label: "Payment",
    icon: <DollarSign size={14} />,
    accent: "bg-[#d8f0e0] text-[#2f7d52]",
    description: "Collect payment via a gateway",
  },
  {
    type: "summary",
    label: "Summary",
    icon: <Menu size={14} />,
    accent: "bg-[#ececea] text-[#57544d]",
    description: "Show a dynamic result page",
  },
  {
    type: "redirect",
    label: "Redirect",
    icon: <ExternalLink size={14} />,
    accent: "bg-[#ececea] text-[#57544d]",
    description: "Send the user to a URL",
  },
];

interface BuilderPaletteProps {
  /** Add a form_field node preset to this field type. */
  onAddField: (fieldType: string) => void;
  /** Add a logic node (group/decision/calculator/payment/summary/redirect). */
  onAddNode: (type: Exclude<FlowNodeType, "start" | "form_field">) => void;
}

export function BuilderPalette({ onAddField, onAddNode }: BuilderPaletteProps) {
  return (
    <aside className="flex flex-col gap-5">
      {/* Fields */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-[#8e8b82]">
          Fields
        </p>
        {FIELD_ITEMS.map(({ fieldType, label, icon }) => (
          <button
            key={fieldType}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(FLOW_DND_MIME, "form_field");
              e.dataTransfer.effectAllowed = "move";
            }}
            onClick={() => onAddField(fieldType)}
            className="flex items-center gap-3 rounded-lg border border-[#e6dfd8] bg-[#faf9f5] px-3 py-2.5 text-left text-sm transition-colors hover:border-[#cc785c] hover:bg-[#efe9de] active:bg-[#e8e0d2]"
          >
            <span className="flex h-7 w-7 flex-none items-center justify-center rounded-md bg-[#efe9de] text-[#cc785c]">
              {icon}
            </span>
            <span className="text-[#141413]">{label}</span>
          </button>
        ))}
      </div>

      {/* Logic */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-[#8e8b82]">
          Logic
        </p>
        {LOGIC_ITEMS.map(({ type, label, icon, accent, description }) => (
          <button
            key={type}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(FLOW_DND_MIME, type);
              e.dataTransfer.effectAllowed = "move";
            }}
            onClick={() => onAddNode(type)}
            className="flex items-start gap-3 rounded-lg border border-[#e6dfd8] bg-[#faf9f5] px-3 py-2.5 text-left transition-colors hover:border-[#cc785c] hover:bg-[#efe9de] active:bg-[#e8e0d2]"
          >
            <span
              className={`flex h-7 w-7 flex-none items-center justify-center rounded-md ${accent}`}
            >
              {icon}
            </span>
            <span className="min-w-0">
              <span className="block text-sm text-[#141413]">{label}</span>
              <span className="block text-xs text-[#8e8b82]">
                {description}
              </span>
            </span>
          </button>
        ))}
      </div>

      <p className="px-1 text-xs text-[#8e8b82]">
        Click to add, or drag onto the Canvas.
      </p>
    </aside>
  );
}
