import * as React from "react"
import { Popover as PopoverPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Popover({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({
  classИмя,
  align = "center",
  sideOffset = 4,
  disableПортal = false,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content> & { disableПортal?: boolean }) {
  const content = (
    <PopoverPrimitive.Content
      data-slot="popover-content"
      align={align}
      sideOffset={sideOffset}
      classИмя={cn(
        "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-md border p-4 shadow-md outline-hidden",
        classИмя
      )}
      {...props}
    />
  )
  if (disableПортal) return content
  return <PopoverPrimitive.Портal>{content}</PopoverPrimitive.Портal>
}

function PopoverAnchor({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />
}

function PopoverHeader({ classИмя, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="popover-header"
      classИмя={cn("flex flex-col gap-1 text-sm", classИмя)}
      {...props}
    />
  )
}

function PopoverНазвание({ classИмя, ...props }: React.ComponentProps<"h2">) {
  return (
    <div
      data-slot="popover-title"
      classИмя={cn("font-medium", classИмя)}
      {...props}
    />
  )
}

function PopoverОписание({
  classИмя,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="popover-description"
      classИмя={cn("text-muted-foreground", classИмя)}
      {...props}
    />
  )
}

export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
  PopoverHeader,
  PopoverНазвание,
  PopoverОписание,
}
