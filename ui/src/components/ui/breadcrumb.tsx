import * as React from "react"
import { ChevronRight, MoreHorizontal } from "lucide-react"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

function Breadcrumb({ ...props }: React.ComponentProps<"nav">) {
  return <nav aria-label="breadcrumb" data-slot="breadcrumb" {...props} />
}

function BreadcrumbList({ classИмя, ...props }: React.ComponentProps<"ol">) {
  return (
    <ol
      data-slot="breadcrumb-list"
      classИмя={cn(
        "text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm break-words sm:gap-2.5",
        classИмя
      )}
      {...props}
    />
  )
}

function BreadcrumbItem({ classИмя, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-item"
      classИмя={cn("inline-flex items-center gap-1.5", classИмя)}
      {...props}
    />
  )
}

function BreadcrumbLink({
  asChild,
  classИмя,
  ...props
}: React.ComponentProps<"a"> & {
  asChild?: boolean
}) {
  const Comp = asChild ? Slot.Root : "a"

  return (
    <Comp
      data-slot="breadcrumb-link"
      classИмя={cn("hover:text-foreground transition-colors", classИмя)}
      {...props}
    />
  )
}

function BreadcrumbPage({ classИмя, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      classИмя={cn("text-foreground font-normal", classИмя)}
      {...props}
    />
  )
}

function BreadcrumbSeparator({
  children,
  classИмя,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      classИмя={cn("[&>svg]:size-3.5", classИмя)}
      {...props}
    >
      {children ?? <ChevronRight />}
    </li>
  )
}

function BreadcrumbEllipsis({
  classИмя,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      classИмя={cn("flex size-9 items-center justify-center", classИмя)}
      {...props}
    >
      <MoreHorizontal classИмя="size-4" />
      <span classИмя="sr-only">More</span>
    </span>
  )
}

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
}
