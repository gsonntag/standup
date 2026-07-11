'use client';

import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({
  className,
  value,
  onChange,
  disabled,
  placeholder,
  rows,
  ...props
}) {
  const handleInput = (e) => {
    onChange?.(e);
  };

  return (
    <md-outlined-text-field
      class={cn("w-full", className)}
      type="textarea"
      placeholder={placeholder}
      value={value || ""}
      rows={rows || 6}
      onInput={handleInput}
      disabled={disabled ? true : undefined}
      {...props}
    />
  );
}

export { Textarea }
