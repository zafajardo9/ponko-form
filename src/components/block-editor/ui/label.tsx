import * as React from "react";

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className = "", htmlFor, ...props }, ref) => (
    <label
      ref={ref}
      className={["block-editor-label", className].filter(Boolean).join(" ")}
      htmlFor={htmlFor}
      {...props}
    />
  )
);
Label.displayName = "Label";

export { Label };
