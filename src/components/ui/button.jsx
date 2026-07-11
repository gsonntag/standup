'use client';

import * as React from "react"
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-sm/relaxed font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline: "border-border hover:bg-input/50 hover:text-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]",
        ghost: "hover:bg-muted hover:text-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/80",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 gap-1.5 px-3 text-sm/relaxed",
        xs: "h-7 gap-1 rounded-md px-2.5 text-xs/relaxed",
        sm: "h-8 gap-1.5 px-3 text-xs/relaxed",
        lg: "h-10 gap-2 px-4 text-sm/relaxed",
        icon: "size-9",
        "icon-xs": "size-7 rounded-md",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  onClick,
  disabled,
  children,
  type = "button",
  ...props
}) {
  if (asChild) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={cn("inline-flex items-center justify-center rounded-md border border-transparent bg-clip-padding text-sm/relaxed font-medium transition-all", className)}
        {...props}
      >
        {children}
      </button>
    );
  }

  let Tag = "md-filled-button";
  if (variant === "outline") Tag = "md-outlined-button";
  else if (variant === "ghost" || variant === "link") Tag = "md-text-button";
  else if (variant === "secondary") Tag = "md-elevated-button";
  else if (variant === "destructive") Tag = "md-filled-button";

  const style = variant === "destructive" ? {
    "--md-filled-button-container-color": "var(--destructive)",
    "--md-filled-button-label-text-color": "white",
  } : {};

  // Map icon elements inside children if needed, or simply render
  return React.createElement(Tag, {
    class: cn(className),
    onClick,
    disabled: disabled ? true : undefined,
    style,
    type,
    ...props
  }, children);
}

export { Button, buttonVariants }
