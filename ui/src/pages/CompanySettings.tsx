import { ChangeEvent, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DEFAULT_COMPANY_ATTACHMENT_MAX_BYTES,
  MAX_COMPANY_ATTACHMENT_MAX_BYTES,
} from "@paperclipai/shared";
import { useКомпания } from "../context/КомпанияContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { companiesApi } from "../api/companies";
import { accessApi } from "../api/access";
import { assetsApi } from "../api/assets";
import { queryКлючs } from "../lib/queryКлючs";
import { Button } from "@/components/ui/button";
import { Настройки, Check, Скачать, Загрузить } from "lucide-react";
import { КомпанияPatternIcon } from "../components/КомпанияPatternIcon";
import {
  Field,
  ToggleField,
  HintIcon,
} from "../components/agent-config-primitives";

type АгентSnippetInput = {
  onboardingTextUrl: string;
  connectionCandidates?: string[] | null;
  testResolutionUrl?: string | null;
};

const BYTES_PER_MIB = 1024 * 1024;
const DEFAULT_COMPANY_ATTACHMENT_MAX_MIB = DEFAULT_COMPANY_ATTACHMENT_MAX_BYTES / BYTES_PER_MIB;
const MAX_COMPANY_ATTACHMENT_MAX_MIB = MAX_COMPANY_ATTACHMENT_MAX_BYTES / BYTES_PER_MIB;
export function КомпанияНастройки() {
  const {
    companies,
    selectedКомпания,
    selectedКомпанияId,
    setSelectedКомпанияId
  } = useКомпания();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  // Общие settings local state
  const [companyИмя, setКомпанияИмя] = useState("");
  const [description, setОписание] = useState("");
  const [brandColor, setBrandColor] = useState("");
  const [attachmentMaxMiB, setAttachmentMaxMiB] = useState(String(DEFAULT_COMPANY_ATTACHMENT_MAX_MIB));
  const [logoUrl, setLogoUrl] = useState("");
  const [logoЗагрузитьОшибка, setLogoЗагрузитьОшибка] = useState<string | null>(null);

  // Sync local state from selected company
  useEffect(() => {
    if (!selectedКомпания) return;
    setКомпанияИмя(selectedКомпания.name);
    setОписание(selectedКомпания.description ?? "");
    setBrandColor(selectedКомпания.brandColor ?? "");
    setAttachmentMaxMiB(String(Math.round((selectedКомпания.attachmentMaxBytes ?? DEFAULT_COMPANY_ATTACHMENT_MAX_BYTES) / BYTES_PER_MIB)));
    setLogoUrl(selectedКомпания.logoUrl ?? "");
  }, [selectedКомпания]);

  const [inviteОшибка, setInviteОшибка] = useState<string | null>(null);
  const [inviteSnippet, setInviteSnippet] = useState<string | null>(null);
  const [snippetCopied, setSnippetCopied] = useState(false);
  const [snippetКопироватьDelightId, setSnippetКопироватьDelightId] = useState(0);

  const attachmentMaxBytes = Number.parseInt(attachmentMaxMiB, 10) * BYTES_PER_MIB;
  const attachmentMaxValid =
    Number.isInteger(attachmentMaxBytes)
    && attachmentMaxBytes >= BYTES_PER_MIB
    && attachmentMaxBytes <= MAX_COMPANY_ATTACHMENT_MAX_BYTES;

  const generalDirty =
    !!selectedКомпания &&
    (companyИмя !== selectedКомпания.name ||
      description !== (selectedКомпания.description ?? "") ||
      brandColor !== (selectedКомпания.brandColor ?? "") ||
      attachmentMaxBytes !== (selectedКомпания.attachmentMaxBytes ?? DEFAULT_COMPANY_ATTACHMENT_MAX_BYTES));

  const generalMutation = useMutation({
    mutationFn: (data: {
      name: string;
      description: string | null;
      brandColor: string | null;
      attachmentMaxBytes: number;
    }) => companiesApi.update(selectedКомпанияId!, data),
    onУспешно: () => {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.companies.all });
    }
  });

  const settingsMutation = useMutation({
    mutationFn: (requireСогласование: boolean) =>
      companiesApi.update(selectedКомпанияId!, {
        requireСоветСогласованиеForNewАгенты: requireСогласование
      }),
    onУспешно: () => {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.companies.all });
    }
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      accessApi.createOpenClawInvitePrompt(selectedКомпанияId!),
    onУспешно: async (invite) => {
      setInviteОшибка(null);
      const base = window.location.origin.replace(/\/+$/, "");
      const onboardingTextLink =
        invite.onboardingTextUrl ??
        invite.onboardingTextПуть ??
        `/api/invites/${invite.token}/onboarding.txt`;
      const absoluteUrl = onboardingTextLink.startsWith("http")
        ? onboardingTextLink
        : `${base}${onboardingTextLink}`;
      setSnippetCopied(false);
      setSnippetКопироватьDelightId(0);
      let snippet: string;
      try {
        const manifest = await accessApi.getInviteOnboarding(invite.token);
        snippet = buildАгентSnippet({
          onboardingTextUrl: absoluteUrl,
          connectionCandidates:
            manifest.onboarding.connectivity?.connectionCandidates ?? null,
          testResolutionUrl:
            manifest.onboarding.connectivity?.testResolutionEndpoint?.url ??
            null
        });
      } catch {
        snippet = buildАгентSnippet({
          onboardingTextUrl: absoluteUrl,
          connectionCandidates: null,
          testResolutionUrl: null
        });
      }
      setInviteSnippet(snippet);
      try {
        await navigator.clipboard.writeText(snippet);
        setSnippetCopied(true);
        setSnippetКопироватьDelightId((prev) => prev + 1);
        setTimeout(() => setSnippetCopied(false), 2000);
      } catch {
        /* clipboard may not be available */
      }
      queryClient.invalidateQueries({
        queryКлюч: queryКлючs.sidebarBadges(selectedКомпанияId!)
      });
    },
    onОшибка: (err) => {
      setInviteОшибка(
        err instanceof Ошибка ? err.message : "Ошибка to create invite"
      );
    }
  });

  const syncLogoState = (nextLogoUrl: string | null) => {
    setLogoUrl(nextLogoUrl ?? "");
    void queryClient.invalidateQueries({ queryКлюч: queryКлючs.companies.all });
  };

  const logoЗагрузитьMutation = useMutation({
    mutationFn: (file: File) =>
      assetsApi
        .uploadКомпанияLogo(selectedКомпанияId!, file)
        .then((asset) => companiesApi.update(selectedКомпанияId!, { logoAssetId: asset.assetId })),
    onУспешно: (company) => {
      syncLogoState(company.logoUrl);
      setLogoЗагрузитьОшибка(null);
    }
  });

  const clearLogoMutation = useMutation({
    mutationFn: () => companiesApi.update(selectedКомпанияId!, { logoAssetId: null }),
    onУспешно: (company) => {
      setLogoЗагрузитьОшибка(null);
      syncLogoState(company.logoUrl);
    }
  });

  function handleLogoFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.currentЦель.value = "";
    if (!file) return;
    setLogoЗагрузитьОшибка(null);
    logoЗагрузитьMutation.mutate(file);
  }

  function handleОчиститьLogo() {
    clearLogoMutation.mutate();
  }

  useEffect(() => {
    setInviteОшибка(null);
    setInviteSnippet(null);
    setSnippetCopied(false);
    setSnippetКопироватьDelightId(0);
  }, [selectedКомпанияId]);

  const archiveMutation = useMutation({
    mutationFn: ({
      companyId,
      nextКомпанияId
    }: {
      companyId: string;
      nextКомпанияId: string | null;
    }) => companiesApi.archive(companyId).then(() => ({ nextКомпанияId })),
    onУспешно: async ({ nextКомпанияId }) => {
      if (nextКомпанияId) {
        setSelectedКомпанияId(nextКомпанияId);
      }
      await queryClient.invalidateQueries({
        queryКлюч: queryКлючs.companies.all
      });
      await queryClient.invalidateQueries({
        queryКлюч: queryКлючs.companies.stats
      });
    }
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedКомпания?.name ?? "Компания", href: "/dashboard" },
      { label: "Настройки" }
    ]);
  }, [setBreadcrumbs, selectedКомпания?.name]);

  if (!selectedКомпания) {
    return (
      <div classИмя="text-sm text-muted-foreground">
        Нет company selected. Select a company from the switcher above.
      </div>
    );
  }

  function handleСохранитьОбщие() {
    generalMutation.mutate({
      name: companyИмя.trim(),
      description: description.trim() || null,
      brandColor: brandColor || null,
      attachmentMaxBytes
    });
  }

  return (
    <div classИмя="max-w-2xl space-y-6">
      <div classИмя="flex items-center gap-2">
        <Настройки classИмя="h-5 w-5 text-muted-foreground" />
        <h1 classИмя="text-lg font-semibold">Компания Настройки</h1>
      </div>

      {/* Общие */}
      <div classИмя="space-y-4">
        <div classИмя="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Общие
        </div>
        <div classИмя="space-y-3 rounded-md border border-border px-4 py-4">
          <Field label="Компания name" hint="The display name for your company.">
            <input
              classИмя="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              type="text"
              value={companyИмя}
              onChange={(e) => setКомпанияИмя(e.target.value)}
            />
          </Field>
          <Field
            label="Описание"
            hint="Опционально description shown in the company profile."
          >
            <input
              classИмя="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              type="text"
              value={description}
              placeholder="Опционально company description"
              onChange={(e) => setОписание(e.target.value)}
            />
          </Field>
        </div>
      </div>

      {/* Appearance */}
      <div classИмя="space-y-4">
        <div classИмя="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Appearance
        </div>
        <div classИмя="space-y-3 rounded-md border border-border px-4 py-4">
          <div classИмя="flex items-start gap-4">
            <div classИмя="shrink-0">
              <КомпанияPatternIcon
                companyИмя={companyИмя || selectedКомпания.name}
                logoUrl={logoUrl || null}
                brandColor={brandColor || null}
                classИмя="rounded-[14px]"
              />
            </div>
            <div classИмя="flex-1 space-y-3">
              <Field
                label="Logo"
                hint="Загрузить a PNG, JPEG, WEBP, GIF, or SVG logo image."
              >
                <div classИмя="space-y-2">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                    onChange={handleLogoFileChange}
                    classИмя="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none file:mr-4 file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1 file:text-xs"
                  />
                  {logoUrl && (
                    <div classИмя="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleОчиститьLogo}
                        disabled={clearLogoMutation.isОжидание}
                      >
                        {clearLogoMutation.isОжидание ? "Removing..." : "Удалить logo"}
                      </Button>
                    </div>
                  )}
                  {(logoЗагрузитьMutation.isОшибка || logoЗагрузитьОшибка) && (
                    <span classИмя="text-xs text-destructive">
                      {logoЗагрузитьОшибка ??
                        (logoЗагрузитьMutation.error instanceof Ошибка
                          ? logoЗагрузитьMutation.error.message
                          : "Logo upload failed")}
                    </span>
                  )}
                  {clearLogoMutation.isОшибка && (
                    <span classИмя="text-xs text-destructive">
                      {clearLogoMutation.error.message}
                    </span>
                  )}
                  {logoЗагрузитьMutation.isОжидание && (
                    <span classИмя="text-xs text-muted-foreground">Загрузитьing logo...</span>
                  )}
                </div>
              </Field>
              <Field
                label="Brand color"
                hint="Sets the hue for the company icon. Leave empty for auto-generated color."
              >
                <div classИмя="flex items-center gap-2">
                  <input
                    type="color"
                    value={brandColor || "#6366f1"}
                    onChange={(e) => setBrandColor(e.target.value)}
                    classИмя="h-8 w-8 cursor-pointer rounded border border-border bg-transparent p-0"
                  />
                  <input
                    type="text"
                    value={brandColor}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || /^#[0-9a-fA-F]{0,6}$/.test(v)) {
                        setBrandColor(v);
                      }
                    }}
                    placeholder="Авто"
                    classИмя="w-28 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm font-mono outline-none"
                  />
                  {brandColor && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setBrandColor("")}
                      classИмя="text-xs text-muted-foreground"
                    >
                      Очистить
                    </Button>
                  )}
                </div>
              </Field>
              <Field
                label="Attachment size limit"
                hint={`Принятьed range: 1-${MAX_COMPANY_ATTACHMENT_MAX_MIB} MiB.`}
              >
                <div classИмя="flex flex-col gap-1.5">
                  <div classИмя="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={MAX_COMPANY_ATTACHMENT_MAX_MIB}
                      step={1}
                      value={attachmentMaxMiB}
                      onChange={(e) => setAttachmentMaxMiB(e.target.value)}
                      classИмя="w-28 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                    />
                    <span classИмя="text-xs text-muted-foreground">MiB</span>
                  </div>
                  {!attachmentMaxValid && (
                    <span classИмя="text-xs text-destructive">
                      Enter a whole number from 1 to {MAX_COMPANY_ATTACHMENT_MAX_MIB}.
                    </span>
                  )}
                </div>
              </Field>
            </div>
          </div>
        </div>
      </div>

      {/* Сохранить button for Общие + Appearance */}
      {generalDirty && (
        <div classИмя="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleСохранитьОбщие}
            disabled={generalMutation.isОжидание || !companyИмя.trim() || !attachmentMaxValid}
          >
            {generalMutation.isОжидание ? "Saving..." : "Сохранить изменения"}
          </Button>
          {generalMutation.isУспешно && (
            <span classИмя="text-xs text-muted-foreground">Сохранитьd</span>
          )}
          {generalMutation.isОшибка && (
            <span classИмя="text-xs text-destructive">
              {generalMutation.error instanceof Ошибка
                  ? generalMutation.error.message
                  : "Ошибка to save"}
            </span>
          )}
        </div>
      )}

      {/* Hiring */}
      <div classИмя="space-y-4" data-testid="company-settings-team-section">
        <div classИмя="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Hiring
        </div>
        <div classИмя="rounded-md border border-border px-4 py-3">
          <ToggleField
            label="Require board approval for new hires"
            hint="Новый агент hires stay pending until approved by board."
            checked={!!selectedКомпания.requireСоветСогласованиеForNewАгенты}
            onChange={(v) => settingsMutation.mutate(v)}
            toggleПроверитьId="company-settings-team-approval-toggle"
          />
        </div>
      </div>

      {/* Invites */}
      <div classИмя="space-y-4" data-testid="company-settings-invites-section">
        <div classИмя="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Invites
        </div>
        <div classИмя="space-y-3 rounded-md border border-border px-4 py-4">
          <div classИмя="flex items-center gap-1.5">
            <span classИмя="text-xs text-muted-foreground">
              Generate an OpenClaw agent invite snippet.
            </span>
            <HintIcon text="Создатьs a short-lived OpenClaw agent invite and renders a copy-ready prompt." />
          </div>
          <div classИмя="flex flex-wrap items-center gap-2">
            <Button
              data-testid="company-settings-invites-generate-button"
              size="sm"
              onClick={() => inviteMutation.mutate()}
              disabled={inviteMutation.isОжидание}
            >
              {inviteMutation.isОжидание
                ? "Generating..."
                : "Generate OpenClaw Invite Prompt"}
            </Button>
          </div>
          {inviteОшибка && (
            <p classИмя="text-sm text-destructive">{inviteОшибка}</p>
          )}
          {inviteSnippet && (
            <div
              classИмя="rounded-md border border-border bg-muted/30 p-2"
              data-testid="company-settings-invites-snippet"
            >
              <div classИмя="flex items-center justify-between gap-2">
                <div classИмя="text-xs text-muted-foreground">
                  OpenClaw Invite Prompt
                </div>
                {snippetCopied && (
                  <span
                    key={snippetКопироватьDelightId}
                    classИмя="flex items-center gap-1 text-xs text-green-600 animate-pulse"
                  >
                    <Check classИмя="h-3 w-3" />
                    Copied
                  </span>
                )}
              </div>
              <div classИмя="mt-1 space-y-1.5">
                <textarea
                  data-testid="company-settings-invites-snippet-textarea"
                  classИмя="h-[28rem] w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none"
                  value={inviteSnippet}
                  readOnly
                />
                <div classИмя="flex justify-end">
                  <Button
                    data-testid="company-settings-invites-copy-button"
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(inviteSnippet);
                        setSnippetCopied(true);
                        setSnippetКопироватьDelightId((prev) => prev + 1);
                        setTimeout(() => setSnippetCopied(false), 2000);
                      } catch {
                        /* clipboard may not be available */
                      }
                    }}
                  >
                    {snippetCopied ? "Copied snippet" : "Копировать snippet"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Импорт / Экспорт */}
      <div classИмя="space-y-4">
        <div classИмя="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Компания Packages
        </div>
        <div classИмя="rounded-md border border-border px-4 py-4">
          <p classИмя="text-sm text-muted-foreground">
            Импорт and export have moved to dedicated pages accessible from the{" "}
            <a href="/org" classИмя="underline hover:text-foreground">Оргструктура Chart</a> header.
          </p>
          <div classИмя="mt-3 flex items-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <a href="/company/export">
                <Скачать classИмя="mr-1.5 h-3.5 w-3.5" />
                Экспорт
              </a>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href="/company/import">
                <Загрузить classИмя="mr-1.5 h-3.5 w-3.5" />
                Импорт
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div classИмя="space-y-4">
        <div classИмя="text-xs font-medium text-destructive uppercase tracking-wide">
          Danger Zone
        </div>
        <div classИмя="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-4">
          <p classИмя="text-sm text-muted-foreground">
            Архивировать this company to hide it from the sidebar. This persists in
            the database.
          </p>
          <div classИмя="flex items-center gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={
                archiveMutation.isОжидание ||
                selectedКомпания.status === "archived"
              }
              onClick={() => {
                if (!selectedКомпанияId) return;
                const confirmed = window.confirm(
                  `Архивировать company "${selectedКомпания.name}"? It will be hidden from the sidebar.`
                );
                if (!confirmed) return;
                const nextКомпанияId =
                  companies.find(
                    (company) =>
                      company.id !== selectedКомпанияId &&
                      company.status !== "archived"
                  )?.id ?? null;
                archiveMutation.mutate({
                  companyId: selectedКомпанияId,
                  nextКомпанияId
                });
              }}
            >
              {archiveMutation.isОжидание
                ? "Archiving..."
                : selectedКомпания.status === "archived"
                ? "Already archived"
                : "Архивировать company"}
            </Button>
            {archiveMutation.isОшибка && (
              <span classИмя="text-xs text-destructive">
                {archiveMutation.error instanceof Ошибка
                  ? archiveMutation.error.message
                  : "Ошибка to archive company"}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function buildАгентSnippet(input: АгентSnippetInput) {
  const candidateUrls = buildCandidateOnboardingUrls(input);
  const resolutionПроверитьUrl = buildResolutionПроверитьUrl(input);

  const candidateList =
    candidateUrls.length > 0
      ? candidateUrls.map((u) => `- ${u}`).join("\n")
      : "- (Нет candidate URLs available yet.)";

  const connectivityBlock =
    candidateUrls.length === 0
      ? `Нет candidate URLs are available. Ask your user to configure a reachable hostname in Paperclip, then retry.
Suggested steps:
- choose a hostname that resolves to the Paperclip host from your runtime
- run: pnpm paperclipai allowed-hostname <host>
- restart Paperclip
- verify with: curl -fsS http://<host>:3100/api/health
- regenerate this invite snippet`
      : `If none are reachable, ask your user to add a reachable hostname in Paperclip, restart, and retry.
Suggested command:
- pnpm paperclipai allowed-hostname <host>
Then verify with: curl -fsS <base-url>/api/health`;

  const resolutionLine = resolutionПроверитьUrl
    ? `\nYou MUST test Paperclip-to-gateway reachability, call: ${resolutionПроверитьUrl}?url=<urlencoded-gateway-url> (using the hostname that worked above). Do not assume your 172.x is necessarily reachable from Paperclip. Проверить it. `
    : "";

  return `You're invited to join a Paperclip organization.

The URLs you should try are:
${candidateList}

Connectivity guidance:
If you are running on a different machine than Paperclip, Paperclip must be reachable at one of the hostnames used above.
Verify the hostname works from your runtime with: GET <base-url>/api/health

${connectivityBlock}

For your "agentИмя", just use your own agent name (OpenClaw or whatever your name is) and send it directly.
You also need to send a gateway URL that Paperclip can access. Check your config and include that URL.${resolutionLine}

---

This onboarding flow is for OpenClaw Gateway.
When you submit the join request, use:
- \`adapterТип: "openclaw_gateway"\`
- \`agentПо умолчаниюsPayload.url\` as your \`ws://\` or \`wss://\` gateway URL
- \`agentПо умолчаниюsPayload.headers["x-openclaw-token"]\` with your gateway token
- (legacy accepted) \`agentПо умолчаниюsPayload.headers["x-openclaw-auth"]\`
- Keep device auth enabled (recommended). If \`devicePrivateКлючPem\` is omitted, Paperclip will generate and persist one during join so pairing approvals remain stable.
- Only use \`disableDeviceAuth=true\` for special environments where pairing cannot be completed.

Do NOT use \`/v1/responses\` or \`/hooks/*\` in this join flow.

Before you do anything, please respond to your user that you understand the instructions and you're going to work on them. Then do the step above in another session called "paperclip-onboarding" and then tell your user when you're done. Обновить your user in intermediate steps along the way so they know what's going on.

Then after you've connected to Paperclip (exchanged keys etc.) you MUST review and follow the onboarding instructions in onboarding.txt they give you.

`;
}

function buildCandidateOnboardingUrls(input: АгентSnippetInput): string[] {
  const candidates = (input.connectionCandidates ?? [])
    .map((candidate) => candidate.trim())
    .filter(Boolean);
  const urls = new Set<string>();
  let onboardingUrl: URL | null = null;

  try {
    onboardingUrl = new URL(input.onboardingTextUrl);
    urls.add(onboardingUrl.toString());
  } catch {
    const trimmed = input.onboardingTextUrl.trim();
    if (trimmed) {
      urls.add(trimmed);
    }
  }

  if (!onboardingUrl) {
    for (const candidate of candidates) {
      urls.add(candidate);
    }
    return Array.from(urls);
  }

  const onboardingПуть = `${onboardingUrl.pathname}${onboardingUrl.search}`;
  for (const candidate of candidates) {
    try {
      const base = new URL(candidate);
      urls.add(`${base.origin}${onboardingПуть}`);
    } catch {
      urls.add(candidate);
    }
  }

  return Array.from(urls);
}

function buildResolutionПроверитьUrl(input: АгентSnippetInput): string | null {
  const explicit = input.testResolutionUrl?.trim();
  if (explicit) return explicit;

  try {
    const onboardingUrl = new URL(input.onboardingTextUrl);
    const testПуть = onboardingUrl.pathname.replace(
      /\/onboarding\.txt$/,
      "/test-resolution"
    );
    return `${onboardingUrl.origin}${testПуть}`;
  } catch {
    return null;
  }
}
