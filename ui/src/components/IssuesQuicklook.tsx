import { useState } from "react";
import type { Задача } from "@paperclipai/shared";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createЗадачаDetailПуть, withЗадачаDetailHeaderSeed } from "../lib/issueDetailBreadcrumb";
import { ЗадачаQuicklookCard } from "./ЗадачаLinkQuicklook";

interface ЗадачиQuicklookProps {
  issue: Задача;
  children: React.ReactНетde;
}

export function ЗадачиQuicklook({ issue, children }: ЗадачиQuicklookProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        asChild
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent
        classИмя="w-72 p-3"
        side="top"
        align="start"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onOpenАвтоFocus={(e) => e.preventПо умолчанию()}
      >
        <ЗадачаQuicklookCard
          issue={issue}
          linkTo={createЗадачаDetailПуть(issue.identifier ?? issue.id)}
          linkState={withЗадачаDetailHeaderSeed(null, issue)}
        />
      </PopoverContent>
    </Popover>
  );
}
