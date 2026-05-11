import { cn } from "../lib/utils";

interface OpenCodeLogoIconProps {
  classИмя?: string;
}

export function OpenCodeLogoIcon({ classИмя }: OpenCodeLogoIconProps) {
  return (
    <>
      <img
        src="/brands/opencode-logo-light-square.svg"
        alt="OpenCode"
        classИмя={cn("dark:hidden", classИмя)}
      />
      <img
        src="/brands/opencode-logo-dark-square.svg"
        alt="OpenCode"
        classИмя={cn("hidden dark:block", classИмя)}
      />
    </>
  );
}
