import * as React from "react"

import { cn } from "@/lib/utils"

function Card({ classИмя, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      classИмя={cn(
        "bg-card text-card-foreground flex flex-col gap-6 border py-6 shadow-sm",
        classИмя
      )}
      {...props}
    />
  )
}

function CardHeader({ classИмя, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      classИмя={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        classИмя
      )}
      {...props}
    />
  )
}

function CardНазвание({ classИмя, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      classИмя={cn("leading-none font-semibold", classИмя)}
      {...props}
    />
  )
}

function CardОписание({ classИмя, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      classИмя={cn("text-muted-foreground text-sm", classИмя)}
      {...props}
    />
  )
}

function CardAction({ classИмя, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      classИмя={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        classИмя
      )}
      {...props}
    />
  )
}

function CardContent({ classИмя, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      classИмя={cn("px-6", classИмя)}
      {...props}
    />
  )
}

function CardFooter({ classИмя, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      classИмя={cn("flex items-center px-6 [.border-t]:pt-6", classИмя)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardНазвание,
  CardAction,
  CardОписание,
  CardContent,
}
