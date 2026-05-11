import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogПортal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Портal>) {
  return <DialogPrimitive.Портal data-slot="dialog-portal" {...props} />
}

function DialogЗакрыть({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Закрыть>) {
  return <DialogPrimitive.Закрыть data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  classИмя,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      classИмя={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50 duration-100",
        classИмя
      )}
      {...props}
    />
  )
}

function DialogContent({
  classИмя,
  children,
  showЗакрытьButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showЗакрытьButton?: boolean
}) {
  return (
    <DialogПортal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        classИмя={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-[0.97] data-[state=open]:zoom-in-[0.97] data-[state=closed]:slide-out-to-top-[1%] data-[state=open]:slide-in-from-top-[1%] fixed top-[max(1rem,env(safe-area-inset-top))] md:top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-0 md:translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] outline-none sm:max-w-lg",
          classИмя
        )}
        {...props}
      >
        {children}
        {showЗакрытьButton && (
          <DialogPrimitive.Закрыть
            data-slot="dialog-close"
            classИмя="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span classИмя="sr-only">Закрыть</span>
          </DialogPrimitive.Закрыть>
        )}
      </DialogPrimitive.Content>
    </DialogПортal>
  )
}

function DialogHeader({ classИмя, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      classИмя={cn("flex flex-col gap-2 text-center sm:text-left", classИмя)}
      {...props}
    />
  )
}

function DialogFooter({
  classИмя,
  showЗакрытьButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showЗакрытьButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      classИмя={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        classИмя
      )}
      {...props}
    >
      {children}
      {showЗакрытьButton && (
        <DialogPrimitive.Закрыть asChild>
          <Button variant="outline">Закрыть</Button>
        </DialogPrimitive.Закрыть>
      )}
    </div>
  )
}

function DialogНазвание({
  classИмя,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Название>) {
  return (
    <DialogPrimitive.Название
      data-slot="dialog-title"
      classИмя={cn("text-lg leading-none font-semibold", classИмя)}
      {...props}
    />
  )
}

function DialogОписание({
  classИмя,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Описание>) {
  return (
    <DialogPrimitive.Описание
      data-slot="dialog-description"
      classИмя={cn("text-muted-foreground text-sm", classИмя)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogЗакрыть,
  DialogContent,
  DialogОписание,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogПортal,
  DialogНазвание,
  DialogTrigger,
}
