import * as React from "react";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", ...props }, ref) => (
    <textarea
      ref={ref}
      className={["block-editor-textarea", className].filter(Boolean).join(" ")}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export { Textarea };
