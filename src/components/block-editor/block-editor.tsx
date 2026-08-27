import { DragHandle } from "@tiptap/extension-drag-handle-react";
import { EditorContent } from "@tiptap/react";

import { BubbleMenu } from "./bubble-menu";
import { BlockEditorProvider, useBlockEditorContext } from "./context";
import { cn } from "./lib/utils";
import type { BlockEditorProps } from "./types";

const BlockEditorContent = () => {
  const { editor, icons } = useBlockEditorContext();

  return (
    <div className="block-editor">
      {editor && editor.isEditable && (
        <DragHandle editor={editor}>{icons.dragHandleIcon}</DragHandle>
      )}
      {editor && editor.isEditable && <BubbleMenu editor={editor} />}
      <EditorContent editor={editor} className="block-editor-content" />
    </div>
  );
};

const BlockEditorRoot = ({
  editor,
  children,
  className,
  labels,
  icons,
}: BlockEditorProps) => (
  <BlockEditorProvider editor={editor} labels={labels} icons={icons}>
    <div className={cn("block-editor", className)}>
      {children ?? <BlockEditorContent />}
    </div>
  </BlockEditorProvider>
);

export const BlockEditor = Object.assign(BlockEditorRoot, {
  BubbleMenu,
  Content: BlockEditorContent,
});
