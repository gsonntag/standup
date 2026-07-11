'use client';

import * as React from "react"
import { cn } from "@/lib/utils"

function Checkbox({
  className,
  checked,
  onCheckedChange,
  disabled,
  ...props
}) {
  const handleChange = (e) => {
    onCheckedChange?.(e.target.checked);
  };

  return (
    <md-checkbox
      class={cn(className)}
      checked={checked ? true : undefined}
      disabled={disabled ? true : undefined}
      onChange={handleChange}
      {...props}
    />
  );
}

export { Checkbox }
