'use client';

import * as React from "react"
import { cn } from "@/lib/utils"

function Input({
  className,
  type = "text",
  placeholder,
  value,
  onChange,
  disabled,
  ...props
}) {
  const handleInput = (e) => {
    onChange?.(e);
  };

  return (
    <md-outlined-text-field
      class={cn("w-full", className)}
      type={type}
      placeholder={placeholder}
      value={value || ""}
      onInput={handleInput}
      disabled={disabled ? true : undefined}
      {...props}
    />
  );
}

export { Input }
