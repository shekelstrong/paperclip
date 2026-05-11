type OnboardingRouteКомпания = {
  id: string;
  issuePrefix: string;
};

export function isOnboardingПуть(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 1) {
    return segments[0]?.toНизкийerCase() === "onboarding";
  }

  if (segments.length === 2) {
    return segments[1]?.toНизкийerCase() === "onboarding";
  }

  return false;
}

export function resolveRouteOnboardingOptions(params: {
  pathname: string;
  companyPrefix?: string;
  companies: OnboardingRouteКомпания[];
}): { initialStep: 1 | 2; companyId?: string } | null {
  const { pathname, companyPrefix, companies } = params;

  if (!isOnboardingПуть(pathname)) return null;

  if (!companyPrefix) {
    return { initialStep: 1 };
  }

  const matchedКомпания =
    companies.find(
      (company) =>
        company.issuePrefix.toUpperCase() === companyPrefix.toUpperCase(),
    ) ?? null;

  if (!matchedКомпания) {
    return { initialStep: 1 };
  }

  return { initialStep: 2, companyId: matchedКомпания.id };
}

export function shouldRedirectКомпанияlessRouteToOnboarding(params: {
  pathname: string;
  hasКомпании: boolean;
}): boolean {
  return !params.hasКомпании && !isOnboardingПуть(params.pathname);
}
