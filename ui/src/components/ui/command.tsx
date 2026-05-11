"use client"

import * as React from "react"
import { Команда as КомандаPrimitive } from "cmdk"
import { ПоискIcon, XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogОписание,
  DialogHeader,
  DialogНазвание,
} from "@/components/ui/dialog"

function Команда({
  classИмя,
  ...props
}: React.ComponentProps<typeof КомандаPrimitive>) {
  return (
    <КомандаPrimitive
      data-slot="command"
      classИмя={cn(
        "bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-md",
        classИмя
      )}
      {...props}
    />
  )
}

function КомандаDialog({
  title = "Команда Palette",
  description = "Поиск for a command to run...",
  children,
  classИмя,
  showЗакрытьButton = true,
  ...props
}: React.ComponentProps<typeof Dialog> & {
  title?: string
  description?: string
  classИмя?: string
  showЗакрытьButton?: boolean
}) {
  return (
    <Dialog {...props}>
      <DialogHeader classИмя="sr-only">
        <DialogНазвание>{title}</DialogНазвание>
        <DialogОписание>{description}</DialogОписание>
      </DialogHeader>
      <DialogContent
        classИмя={cn("overflow-hidden p-0", classИмя)}
        showЗакрытьButton={false}
      >
        <Команда classИмя="[&_[cmdk-group-heading]]:text-muted-foreground **:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          {children}
        </Команда>
        {showЗакрытьButton && (
          <DialogPrimitive.Закрыть
            data-slot="dialog-close"
            classИмя="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-0 right-2 flex h-12 items-center rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span classИмя="sr-only">Закрыть</span>
          </DialogPrimitive.Закрыть>
        )}
      </DialogContent>
    </Dialog>
  )
}

function КомандаInput({
  classИмя,
  ...props
}: React.ComponentProps<typeof КомандаPrimitive.Input>) {
  return (
    <div
      data-slot="command-input-wrapper"
      classИмя="flex h-9 items-center gap-2 border-b px-3"
    >
      <ПоискIcon classИмя="size-4 shrink-0 opacity-50" />
      <КомандаPrimitive.Input
        data-slot="command-input"
        classИмя={cn(
          "placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3 text-base md:text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
          classИмя
        )}
        {...props}
      />
    </div>
  )
}

function КомандаList({
  classИмя,
  ...props
}: React.ComponentProps<typeof КомандаPrimitive.List>) {
  return (
    <КомандаPrimitive.List
      data-slot="command-list"
      classИмя={cn(
        "max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto",
        classИмя
      )}
      {...props}
    />
  )
}

function КомандаEmpty({
  ...props
}: React.ComponentProps<typeof КомандаPrimitive.Empty>) {
  return (
    <КомандаPrimitive.Empty
      data-slot="command-empty"
      classИмя="py-6 text-center text-sm"
      {...props}
    />
  )
}

function КомандаGroup({
  classИмя,
  ...props
}: React.ComponentProps<typeof КомандаPrimitive.Group>) {
  return (
    <КомандаPrimitive.Group
      data-slot="command-group"
      classИмя={cn(
        "text-foreground [&_[cmdk-group-heading]]:text-muted-foreground overflow-hidden p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium",
        classИмя
      )}
      {...props}
    />
  )
}

function КомандаSeparator({
  classИмя,
  ...props
}: React.ComponentProps<typeof КомандаPrimitive.Separator>) {
  return (
    <КомандаPrimitive.Separator
      data-slot="command-separator"
      classИмя={cn("bg-border -mx-1 h-px", classИмя)}
      {...props}
    />
  )
}

function КомандаItem({
  classИмя,
  ...props
}: React.ComponentProps<typeof КомандаPrimitive.Item>) {
  return (
    <КомандаPrimitive.Item
      data-slot="command-item"
      classИмя={cn(
        "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        classИмя
      )}
      {...props}
    />
  )
}

function КомандаShortcut({
  classИмя,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      classИмя={cn(
        "text-muted-foreground ml-auto text-xs tracking-widest",
        classИмя
      )}
      {...props}
    />
  )
}

export {
  Команда,
  КомандаDialog,
  КомандаInput,
  КомандаList,
  КомандаEmpty,
  КомандаGroup,
  КомандаItem,
  КомандаShortcut,
  КомандаSeparator,
}
