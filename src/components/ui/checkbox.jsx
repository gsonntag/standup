"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { CheckIcon } from "@phosphor-icons/react"

function Checkbox({
  className,
  ...props
}) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer group relative flex size-4.5 shrink-0 items-center justify-center rounded-[5px] border border-input transition-shadow outline-none group-has-disabled/field:opacity-50 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary",
        className
      )}
      {...props}>
      <span
        data-slot="checkbox-indicator"
        aria-hidden="true"
        className="pointer-events-none grid place-content-center text-current opacity-0 transition-none group-data-[state=checked]:opacity-100 group-data-[state=indeterminate]:opacity-100 [&>svg]:size-3.5">
        <CheckIcon />
      </span>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox }
