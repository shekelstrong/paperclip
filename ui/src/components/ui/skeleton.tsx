import { cn } from "@/lib/utils"

function Skeleton({ classИмя, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      classИмя={cn("bg-accent/75 rounded-md", classИмя)}
      {...props}
    />
  )
}

export { Skeleton }
