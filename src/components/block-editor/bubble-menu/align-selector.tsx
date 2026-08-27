import type { Editor } from "@tiptap/react";
import { useState } from "react";

import { DEFAULT_ICONS } from "../icons";
import { useEditorState } from "./utils";

interface AlignSelectorResult {
  isAlignLeft: boolean;
  isAlignCenter: boolean;
  isAlignRight: boolean;
}

interface AlignableChain {
  run(): boolean;
  setTextAlign(alignment: "center" | "left" | "right"): AlignableChain;
}

const alignItems = [
  {
    command: (e: Editor) =>
      (e.chain().focus() as unknown as AlignableChain)
        .setTextAlign("left")
        .run(),
    icon: DEFAULT_ICONS.alignLeftIcon,
    isActive: (s: AlignSelectorResult) => s.isAlignLeft,
    label: "Left",
  },
  {
    command: (e: Editor) =>
      (e.chain().focus() as unknown as AlignableChain)
        .setTextAlign("center")
        .run(),
    icon: DEFAULT_ICONS.alignCenterIcon,
    isActive: (s: AlignSelectorResult) => s.isAlignCenter,
    label: "Center",
  },
  {
    command: (e: Editor) =>
      (e.chain().focus() as unknown as AlignableChain)
        .setTextAlign("right")
        .run(),
    icon: DEFAULT_ICONS.alignRightIcon,
    isActive: (s: AlignSelectorResult) => s.isAlignRight,
    label: "Right",
  },
];

export const TextAlignSelector = ({ editor }: { editor: Editor }) => {
  const [open, setOpen] = useState(false);
  const editorState = useEditorState(editor, (ed) => ({
    isAlignCenter: ed.isActive({ textAlign: "center" }),
    isAlignLeft:
      !ed.isActive({ textAlign: "center" }) &&
      !ed.isActive({ textAlign: "right" }),
    isAlignRight: ed.isActive({ textAlign: "right" }),
  }));

  const activeItem = alignItems.find((i) => i.isActive(editorState));

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className="block-editor-bubble-btn"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen(!open)}
      >
        <span className="block-editor-bubble-dropdown-icon">
          {activeItem ? activeItem.icon : DEFAULT_ICONS.alignLeftIcon}
        </span>
        {DEFAULT_ICONS.dropdownArrowIcon}
      </button>
      {open && (
        <>
          <div
            className="block-editor-bubble-overlay"
            role="presentation"
            onClick={() => setOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
              }
            }}
          />
          <div
            className="block-editor-bubble-dropdown block-editor-bubble-dropdown--align"
            style={{ left: "auto", right: 0 }}
          >
            {alignItems.map((item, i) => (
              <button
                key={i}
                type="button"
                className={`block-editor-bubble-dropdown-item${item.isActive(editorState) ? " block-editor-bubble-dropdown-item--active" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  item.command(editor);
                  setOpen(false);
                }}
              >
                <span className="block-editor-bubble-dropdown-icon">
                  {item.icon}
                </span>
                <span>{item.label}</span>
                {item.isActive(editorState) && (
                  <span className="block-editor-bubble-dropdown-icon">
                    {DEFAULT_ICONS.checkIcon}
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
