"use client"

import * as React from "react"
import { DayPicker } from "react-day-picker"
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}) {
  return (
    <DayPicker
      data-slot="calendar"
      showOutsideDays={showOutsideDays}
      className={cn("shadcn-calendar", className)}
      classNames={{
        root: "shadcn-calendar-root",
        months: "shadcn-calendar-months",
        month: "shadcn-calendar-month",
        month_caption: "shadcn-calendar-caption",
        caption_label: "shadcn-calendar-caption-label",
        nav: "shadcn-calendar-nav",
        button_previous: "shadcn-calendar-nav-button shadcn-calendar-nav-button-prev",
        button_next: "shadcn-calendar-nav-button shadcn-calendar-nav-button-next",
        month_grid: "shadcn-calendar-table",
        weekdays: "shadcn-calendar-weekdays",
        weekday: "shadcn-calendar-weekday",
        weeks: "shadcn-calendar-weeks",
        week: "shadcn-calendar-week",
        day: "shadcn-calendar-day",
        day_button: "shadcn-calendar-day-button",
        selected: "shadcn-calendar-selected",
        today: "shadcn-calendar-today",
        outside: "shadcn-calendar-outside",
        disabled: "shadcn-calendar-disabled",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName }) => {
          const Icon = orientation === "left" ? CaretLeftIcon : CaretRightIcon
          return <Icon className={cn("size-4", chevronClassName)} weight="bold" />
        },
      }}
      {...props}
    />
  )
}

export { Calendar }
