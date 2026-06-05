import type { FlowNodeType } from "../../lib/flow-engine/types";
import {
  Square,
  LayoutGrid,
  Diamond,
  Sigma,
  DollarSign,
  Menu,
  ExternalLink,
} from "lucide-react";

/**
 * FlowPalette
 *
 * Left sidebar listing the node types a creator can add. Items are draggable
 * onto the canvas (native HTML5 drag-and-drop — the canvas reads the type from
 * dataTransfer on drop). Clicking an item also adds it (convenience fallback).
 *
 * The Start node is not listed — every flow has exactly one, created with the
 * flow itself.
 */

export const PALETTE_ITEMS: {
  type: Exclude<FlowNodeType, "start">;
  label: string;
  icon: React.ReactNode;
  accent: string;
  description: string;
}[] = [
  {
    type: "form_field",
    label: "Form Field",
    icon: <Square size={14} />,
    accent: "bg-[#dbe7f7] text-[#2f5a9e]",
    description: "Collect input from the user",
  },
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

/** dataTransfer key used to hand the dragged node type to the canvas. */
export const FLOW_DND_MIME = "application/ponkoform-flow-node";

interface FlowPaletteProps {
  onAddNode: (type: Exclude<FlowNodeType, "start">) => void;
}

export function FlowPalette({ onAddNode }: FlowPaletteProps) {
  return (
    <aside className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wider text-[#8e8b82]">
        Node Types
      </p>
      {PALETTE_ITEMS.map(({ type, label, icon, accent, description }) => (
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
            <span className="block text-xs text-[#8e8b82]">{description}</span>
          </span>
        </button>
      ))}
      <p className="mt-2 px-1 text-xs text-[#8e8b82]">
        Drag onto the canvas, or click to add.
      </p>
    </aside>
  );
}
