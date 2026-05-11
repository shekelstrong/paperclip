import { Skeleton } from "@/components/ui/skeleton";

interface PageSkeletonProps {
  variant?:
    | "list"
    | "issues-list"
    | "detail"
    | "dashboard"
    | "approvals"
    | "costs"
    | "inbox"
    | "org-chart";
}

export function PageSkeleton({ variant = "list" }: PageSkeletonProps) {
  if (variant === "dashboard") {
    return (
      <div classИмя="space-y-6">
        <Skeleton classИмя="h-32 w-full border border-border" />

        <div classИмя="grid grid-cols-2 gap-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} classИмя="h-24 w-full" />
          ))}
        </div>

        <div classИмя="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} classИмя="h-44 w-full" />
          ))}
        </div>

        <div classИмя="grid gap-4 md:grid-cols-2">
          <Skeleton classИмя="h-72 w-full" />
          <Skeleton classИмя="h-72 w-full" />
        </div>
      </div>
    );
  }

  if (variant === "approvals") {
    return (
      <div classИмя="space-y-4">
        <div classИмя="flex items-center justify-between">
          <Skeleton classИмя="h-9 w-44" />
        </div>
        <div classИмя="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} classИмя="h-36 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "costs") {
    return (
      <div classИмя="space-y-6">
        <div classИмя="flex flex-wrap items-center gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} classИмя="h-9 w-28" />
          ))}
        </div>

        <Skeleton classИмя="h-40 w-full" />

        <div classИмя="grid gap-4 md:grid-cols-2">
          <Skeleton classИмя="h-72 w-full" />
          <Skeleton classИмя="h-72 w-full" />
        </div>
      </div>
    );
  }

  if (variant === "inbox") {
    return (
      <div classИмя="space-y-6">
        <div classИмя="flex items-center justify-between">
          <Skeleton classИмя="h-9 w-56" />
          <Skeleton classИмя="h-8 w-40" />
        </div>

        <div classИмя="space-y-5">
          {Array.from({ length: 3 }).map((_, section) => (
            <div key={section} classИмя="space-y-2">
              <Skeleton classИмя="h-4 w-40" />
              <div classИмя="space-y-1 border border-border">
                {Array.from({ length: 3 }).map((_, row) => (
                  <Skeleton key={row} classИмя="h-14 w-full rounded-none" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "org-chart") {
    return (
      <div classИмя="space-y-4">
        <Skeleton classИмя="h-[calc(100vh-4rem)] w-full rounded-lg border border-border" />
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div classИмя="space-y-6">
        <div classИмя="space-y-3">
          <Skeleton classИмя="h-3 w-64" />
          <div classИмя="flex items-center gap-2">
            <Skeleton classИмя="h-6 w-6" />
            <Skeleton classИмя="h-6 w-6" />
            <Skeleton classИмя="h-7 w-48" />
          </div>
          <Skeleton classИмя="h-4 w-40" />
        </div>

        <div classИмя="space-y-3">
          <Skeleton classИмя="h-10 w-full" />
          <Skeleton classИмя="h-32 w-full" />
        </div>

        <div classИмя="space-y-2">
          <div classИмя="flex items-center gap-2">
            <Skeleton classИмя="h-8 w-24" />
            <Skeleton classИмя="h-8 w-24" />
            <Skeleton classИмя="h-8 w-24" />
          </div>
          <Skeleton classИмя="h-24 w-full" />
          <Skeleton classИмя="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (variant === "issues-list") {
    return (
      <div classИмя="space-y-4">
        <div classИмя="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton classИмя="h-9 w-64" />
          <div classИмя="flex items-center gap-2">
            <Skeleton classИмя="h-8 w-16" />
            <Skeleton classИмя="h-8 w-16" />
            <Skeleton classИмя="h-8 w-16" />
            <Skeleton classИмя="h-8 w-24" />
          </div>
        </div>

        <div classИмя="space-y-2">
          <Skeleton classИмя="h-4 w-40" />
          <div classИмя="space-y-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} classИмя="h-11 w-full rounded-none" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div classИмя="space-y-4">
      <div classИмя="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton classИмя="h-9 w-44" />
        <div classИмя="flex items-center gap-2">
          <Skeleton classИмя="h-8 w-20" />
          <Skeleton classИмя="h-8 w-24" />
        </div>
      </div>

      <div classИмя="space-y-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} classИмя="h-11 w-full rounded-none" />
        ))}
      </div>
    </div>
  );
}
