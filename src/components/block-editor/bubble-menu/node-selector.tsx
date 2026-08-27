import type { Editor } from "@tiptap/react";
import { useState } from "react";

import { DEFAULT_ICONS } from "../icons";
import { useEditorState, copyBlock, deleteBlock } from "./utils";

interface SelectorResult {
  isParagraph: boolean;
  isHeading1: boolean;
  isHeading2: boolean;
  isHeading3: boolean;
  isBulletList: boolean;
  isOrderedList: boolean;
  isTaskList: boolean;
  isBlockquote: boolean;
  isCodeBlock: boolean;
}

interface NodeItem {
  command: (editor: Editor) => void;
  extension: string;
  icon: React.ReactNode;
  isActive: (state: SelectorResult) => boolean;
  name: string;
}

interface NodeChain {
  run(): boolean;
  setParagraph(): NodeChain;
  toggleBlockquote(): NodeChain;
  toggleBulletList(): NodeChain;
  toggleCodeBlock(): NodeChain;
  toggleHeading(options: { level: number }): NodeChain;
  toggleOrderedList(): NodeChain;
  toggleTaskList(): NodeChain;
}

const nodeItems: NodeItem[] = [
  {
    command: (e) =>
      (e.chain().focus() as unknown as NodeChain).setParagraph().run(),
    icon: DEFAULT_ICONS.slashTextIcon,
    extension: "paragraph",
    isActive: (s) =>
      s.isParagraph &&
      !s.isBulletList &&
      !s.isOrderedList &&
      !s.isTaskList &&
      !s.isBlockquote &&
      !s.isCodeBlock,
    name: "Text",
  },
  {
    command: (e) =>
      (e.chain().focus() as unknown as NodeChain)
        .toggleHeading({ level: 1 })
        .run(),
    icon: DEFAULT_ICONS.slashHeadingIcon,
    extension: "heading",
    isActive: (s) => s.isHeading1,
    name: "Heading 1",
  },
  {
    command: (e) =>
      (e.chain().focus() as unknown as NodeChain)
        .toggleHeading({ level: 2 })
        .run(),
    icon: DEFAULT_ICONS.slashHeadingIcon,
    extension: "heading",
    isActive: (s) => s.isHeading2,
    name: "Heading 2",
  },
  {
    command: (e) =>
      (e.chain().focus() as unknown as NodeChain)
        .toggleHeading({ level: 3 })
        .run(),
    icon: DEFAULT_ICONS.slashHeadingIcon,
    extension: "heading",
    isActive: (s) => s.isHeading3,
    name: "Heading 3",
  },
  {
    command: (e) =>
      (e.chain().focus() as unknown as NodeChain).toggleBulletList().run(),
    icon: DEFAULT_ICONS.slashBulletListIcon,
    extension: "bulletList",
    isActive: (s) => s.isBulletList,
    name: "Bullet List",
  },
  {
    command: (e) =>
      (e.chain().focus() as unknown as NodeChain).toggleOrderedList().run(),
    icon: DEFAULT_ICONS.slashOrderedListIcon,
    extension: "orderedList",
    isActive: (s) => s.isOrderedList,
    name: "Numbered List",
  },
  {
    command: (e) =>
      (e.chain().focus() as unknown as NodeChain).toggleTaskList().run(),
    icon: DEFAULT_ICONS.slashTaskListIcon,
    extension: "taskList",
    isActive: (s) => s.isTaskList,
    name: "To-do List",
  },
  {
    command: (e) =>
      (e.chain().focus() as unknown as NodeChain).toggleBlockquote().run(),
    icon: DEFAULT_ICONS.slashBlockquoteIcon,
    extension: "blockquote",
    isActive: (s) => s.isBlockquote,
    name: "Quote",
  },
  {
    command: (e) =>
      (e.chain().focus() as unknown as NodeChain).toggleCodeBlock().run(),
    icon: DEFAULT_ICONS.slashCodeBlockIcon,
    extension: "codeBlock",
    isActive: (s) => s.isCodeBlock,
    name: "Code Block",
  },
];

export const NodeSelector = ({ editor }: { editor: Editor }) => {
  const [open, setOpen] = useState(false);
  const availableNodeItems = nodeItems.filter((item) =>
    editor.extensionManager.extensions.some((extension) => extension.name === item.extension)
  );
  const editorState = useEditorState(editor, (ed) => ({
    isBlockquote: ed.isActive("blockquote"),
    isBulletList: ed.isActive("bulletList"),
    isCodeBlock: ed.isActive("codeBlock"),
    isHeading1: ed.isActive("heading", { level: 1 }),
    isHeading2: ed.isActive("heading", { level: 2 }),
    isHeading3: ed.isActive("heading", { level: 3 }),
    isOrderedList: ed.isActive("orderedList"),
    isParagraph: ed.isActive("paragraph"),
    isTaskList: ed.isActive("taskList"),
  }));

  const activeItems = availableNodeItems.filter((i) => i.isActive(editorState));
  const activeName =
    activeItems.length > 1 ? "Multiple" : (activeItems[0]?.name ?? "Text");
  const activeIcon = activeItems.length === 1 ? activeItems[0]?.icon : null;

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className="block-editor-bubble-btn"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen(!open)}
      >
        {activeIcon && (
          <span className="block-editor-bubble-dropdown-icon">
            {activeIcon}
          </span>
        )}
        <span className="block-editor-bubble-btn-text">{activeName}</span>
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
          <div className="block-editor-bubble-dropdown">
            {availableNodeItems.map((item, i) => (
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
                <span>{item.name}</span>
                {item.isActive(editorState) && (
                  <span className="block-editor-bubble-dropdown-icon">
                    {DEFAULT_ICONS.checkIcon}
                  </span>
                )}
              </button>
            ))}
            <div className="block-editor-bubble-dropdown-divider" />
            <button
              type="button"
              className="block-editor-bubble-dropdown-item"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                copyBlock(editor);
                setOpen(false);
              }}
            >
              <span className="block-editor-bubble-dropdown-icon">
                {DEFAULT_ICONS.copyIcon}
              </span>
              <span>Copy</span>
            </button>
            <button
              type="button"
              className="block-editor-bubble-dropdown-item block-editor-bubble-dropdown-item--danger"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                deleteBlock(editor);
                setOpen(false);
              }}
            >
              <span className="block-editor-bubble-dropdown-icon">
                {DEFAULT_ICONS.deleteIcon}
              </span>
              <span>Delete</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
