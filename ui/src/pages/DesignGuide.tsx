import { useState } from "react";
import {
  BookOpen,
  Бот,
  Check,
  ChevronDown,
  CircleDot,
  Команда as КомандаIcon,
  DollarSign,
  Hexagon,
  История,
  Входящие,
  LayoutПанель управления,
  ListTodo,
  Mail,
  Plus,
  Поиск,
  Настройки,
  Цель,
  Trash2,
  Загрузить,
  User,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardHeader,
  CardНазвание,
  CardОписание,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogНазвание,
  DialogОписание,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectTrigger,
  SelectЗначение,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetНазвание,
  SheetОписание,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Команда,
  КомандаInput,
  КомандаList,
  КомандаGroup,
  КомандаItem,
  КомандаEmpty,
  КомандаSeparator,
} from "@/components/ui/command";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import { СтатусBadge } from "@/components/СтатусBadge";
import { СтатусIcon } from "@/components/СтатусIcon";
import { ПриоритетIcon } from "@/components/ПриоритетIcon";
import { agentСтатусDot, agentСтатусDotПо умолчанию } from "@/lib/status-colors";
import { EntityRow } from "@/components/EntityRow";
import { EmptyState } from "@/components/EmptyState";
import { MetricCard } from "@/components/MetricCard";
import { ФильтрBar, type ФильтрЗначение } from "@/components/ФильтрBar";
import { InlineИзменитьor } from "@/components/InlineИзменитьor";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Identity } from "@/components/Identity";
import { ЗадачаReferencePill } from "@/components/ЗадачаReferencePill";

/* ------------------------------------------------------------------ */
/*  Section wrapper                                                    */
/* ------------------------------------------------------------------ */

function Section({ title, children }: { title: string; children: React.ReactНетde }) {
  return (
    <section classИмя="space-y-4">
      <h3 classИмя="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {title}
      </h3>
      <Separator />
      {children}
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactНетde }) {
  return (
    <div classИмя="space-y-3">
      <h4 classИмя="text-sm font-medium">{title}</h4>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Color swatch                                                       */
/* ------------------------------------------------------------------ */

function Swatch({ name, cssVar }: { name: string; cssVar: string }) {
  return (
    <div classИмя="flex items-center gap-3">
      <div
        classИмя="h-8 w-8 rounded-md border border-border shrink-0"
        style={{ backgroundColor: `var(${cssVar})` }}
      />
      <div>
        <p classИмя="text-xs font-mono">{cssVar}</p>
        <p classИмя="text-xs text-muted-foreground">{name}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function DesignGuide() {
  const [status, setСтатус] = useState("todo");
  const [priority, setПриоритет] = useState("medium");
  const [selectЗначение, setSelectЗначение] = useState("in_progress");
  const [menuChecked, setMenuChecked] = useState(true);
  const [collapsibleOpen, setCollapsibleOpen] = useState(false);
  const [inlineText, setInlineText] = useState("Click to edit this text");
  const [inlineНазвание, setInlineНазвание] = useState("Изменитьable Название");
  const [inlineDesc, setInlineDesc] = useState(
    "This is an editable description. Click to edit it — the textarea auto-sizes to fit the content without layout shift."
  );
  const [filters, setФильтрs] = useState<ФильтрЗначение[]>([
    { key: "status", label: "Статус", value: "Активен" },
    { key: "priority", label: "Приоритет", value: "Высокий" },
  ]);

  return (
    <div classИмя="space-y-10 max-w-4xl">
      {/* Page header */}
      <div>
        <h2 classИмя="text-xl font-bold">Design Guide</h2>
        <p classИмя="text-sm text-muted-foreground mt-1">
          Every component, style, and pattern used across Paperclip.
        </p>
      </div>

      {/* ============================================================ */}
      {/*  COVERAGE                                                     */}
      {/* ============================================================ */}
      <Section title="Component Coverage">
        <p classИмя="text-sm text-muted-foreground">
          This page should be updated when new UI primitives or app-level patterns ship.
        </p>
        <div classИмя="grid gap-6 md:grid-cols-2">
          <SubSection title="UI primitives">
            <div classИмя="flex flex-wrap gap-2">
              {[
                "avatar", "badge", "breadcrumb", "button", "card", "checkbox", "collapsible",
                "command", "dialog", "dropdown-menu", "input", "label", "popover", "scroll-area",
                "select", "separator", "sheet", "skeleton", "tabs", "textarea", "tooltip",
              ].map((name) => (
                <Badge key={name} variant="outline" classИмя="font-mono text-[10px]">
                  {name}
                </Badge>
              ))}
            </div>
          </SubSection>
          <SubSection title="App components">
            <div classИмя="flex flex-wrap gap-2">
              {[
                "СтатусBadge", "СтатусIcon", "ПриоритетIcon", "EntityRow", "EmptyState", "MetricCard",
                "ФильтрBar", "InlineИзменитьor", "PageSkeleton", "Identity", "CommentThread", "MarkdownИзменитьor",
                "PropertiesPanel", "Sidebar", "КомандаPalette",
              ].map((name) => (
                <Badge key={name} variant="ghost" classИмя="font-mono text-[10px]">
                  {name}
                </Badge>
              ))}
            </div>
          </SubSection>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  COLORS                                                       */}
      {/* ============================================================ */}
      <Section title="Colors">
        <SubSection title="Core">
          <div classИмя="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Swatch name="Назадground" cssVar="--background" />
            <Swatch name="Foreground" cssVar="--foreground" />
            <Swatch name="Card" cssVar="--card" />
            <Swatch name="Primary" cssVar="--primary" />
            <Swatch name="Primary foreground" cssVar="--primary-foreground" />
            <Swatch name="Secondary" cssVar="--secondary" />
            <Swatch name="Muted" cssVar="--muted" />
            <Swatch name="Muted foreground" cssVar="--muted-foreground" />
            <Swatch name="Accent" cssVar="--accent" />
            <Swatch name="Destructive" cssVar="--destructive" />
            <Swatch name="Border" cssVar="--border" />
            <Swatch name="Ring" cssVar="--ring" />
          </div>
        </SubSection>

        <SubSection title="Sidebar">
          <div classИмя="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Swatch name="Sidebar" cssVar="--sidebar" />
            <Swatch name="Sidebar border" cssVar="--sidebar-border" />
          </div>
        </SubSection>

        <SubSection title="Chart">
          <div classИмя="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Swatch name="Chart 1" cssVar="--chart-1" />
            <Swatch name="Chart 2" cssVar="--chart-2" />
            <Swatch name="Chart 3" cssVar="--chart-3" />
            <Swatch name="Chart 4" cssVar="--chart-4" />
            <Swatch name="Chart 5" cssVar="--chart-5" />
          </div>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  TYPOGRAPHY                                                   */}
      {/* ============================================================ */}
      <Section title="Typography">
        <div classИмя="space-y-3">
          <h2 classИмя="text-xl font-bold">Page Название — text-xl font-bold</h2>
          <h2 classИмя="text-lg font-semibold">Section Название — text-lg font-semibold</h2>
          <h3 classИмя="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Section Heading — text-sm font-semibold uppercase tracking-wide
          </h3>
          <p classИмя="text-sm font-medium">Card Название — text-sm font-medium</p>
          <p classИмя="text-sm font-semibold">Card Название Alt — text-sm font-semibold</p>
          <p classИмя="text-sm">Body text — text-sm</p>
          <p classИмя="text-sm text-muted-foreground">
            Muted description — text-sm text-muted-foreground
          </p>
          <p classИмя="text-xs text-muted-foreground">
            Tiny label — text-xs text-muted-foreground
          </p>
          <p classИмя="text-sm font-mono text-muted-foreground">
            Mono identifier — text-sm font-mono text-muted-foreground
          </p>
          <p classИмя="text-2xl font-bold">Large stat — text-2xl font-bold</p>
          <p classИмя="font-mono text-xs">Log/code text — font-mono text-xs</p>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  SPACING & RADIUS                                             */}
      {/* ============================================================ */}
      <Section title="Radius">
        <div classИмя="flex items-end gap-4 flex-wrap">
          {[
            ["sm", "var(--radius-sm)"],
            ["md", "var(--radius-md)"],
            ["lg", "var(--radius-lg)"],
            ["xl", "var(--radius-xl)"],
            ["full", "9999px"],
          ].map(([label, radius]) => (
            <div key={label} classИмя="flex flex-col items-center gap-1">
              <div
                classИмя="h-12 w-12 bg-primary"
                style={{ borderRadius: radius }}
              />
              <span classИмя="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  BUTTONS                                                      */}
      {/* ============================================================ */}
      <Section title="Buttons">
        <SubSection title="Variants">
          <div classИмя="flex items-center gap-2 flex-wrap">
            <Button variant="default">По умолчанию</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
          </div>
        </SubSection>

        <SubSection title="Sizes">
          <div classИмя="flex items-center gap-2 flex-wrap">
            <Button size="xs">Extra Small</Button>
            <Button size="sm">Small</Button>
            <Button size="default">По умолчанию</Button>
            <Button size="lg">Large</Button>
          </div>
        </SubSection>

        <SubSection title="Icon buttons">
          <div classИмя="flex items-center gap-2 flex-wrap">
            <Button variant="ghost" size="icon-xs"><Поиск /></Button>
            <Button variant="ghost" size="icon-sm"><Поиск /></Button>
            <Button variant="outline" size="icon"><Поиск /></Button>
            <Button variant="outline" size="icon-lg"><Поиск /></Button>
          </div>
        </SubSection>

        <SubSection title="With icons">
          <div classИмя="flex items-center gap-2 flex-wrap">
            <Button><Plus /> Новая задача</Button>
            <Button variant="outline"><Загрузить /> Загрузить</Button>
            <Button variant="destructive"><Trash2 /> Удалить</Button>
            <Button size="sm"><Plus /> Добавить</Button>
          </div>
        </SubSection>

        <SubSection title="States">
          <div classИмя="flex items-center gap-2 flex-wrap">
            <Button disabled>Отключитьd</Button>
            <Button variant="outline" disabled>Отключитьd Outline</Button>
          </div>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  BADGES                                                       */}
      {/* ============================================================ */}
      <Section title="Badges">
        <SubSection title="Variants">
          <div classИмя="flex items-center gap-2 flex-wrap">
            <Badge variant="default">По умолчанию</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="ghost">Ghost</Badge>
          </div>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  STATUS BADGES & ICONS                                        */}
      {/* ============================================================ */}
      <Section title="Статус System">
        <SubSection title="СтатусBadge (all statuses)">
          <div classИмя="flex items-center gap-2 flex-wrap">
            {[
              "active", "running", "paused", "idle", "archived", "planned",
              "achieved", "completed", "failed", "timed_out", "succeeded", "error",
              "pending_approval", "backlog", "todo", "in_progress", "in_review", "blocked",
              "done", "terminated", "cancelled", "pending", "revision_requested",
              "approved", "rejected",
            ].map((s) => (
              <СтатусBadge key={s} status={s} />
            ))}
          </div>
        </SubSection>

        <SubSection title="СтатусIcon (interactive)">
          <div classИмя="flex items-center gap-3 flex-wrap">
            {["backlog", "todo", "in_progress", "in_review", "done", "cancelled", "blocked"].map(
              (s) => (
                <div key={s} classИмя="flex items-center gap-1.5">
                  <СтатусIcon status={s} />
                  <span classИмя="text-xs text-muted-foreground">{s}</span>
                </div>
              )
            )}
          </div>
          <div classИмя="flex items-center gap-2 mt-2">
            <СтатусIcon status={status} onChange={setСтатус} />
            <span classИмя="text-sm">Click the icon to change status (current: {status})</span>
          </div>
        </SubSection>

        <SubSection title="ПриоритетIcon (interactive)">
          <div classИмя="flex items-center gap-3 flex-wrap">
            {["critical", "high", "medium", "low"].map((p) => (
              <div key={p} classИмя="flex items-center gap-1.5">
                <ПриоритетIcon priority={p} />
                <span classИмя="text-xs text-muted-foreground">{p}</span>
              </div>
            ))}
          </div>
          <div classИмя="flex items-center gap-2 mt-2">
            <ПриоритетIcon priority={priority} onChange={setПриоритет} />
            <span classИмя="text-sm">Click the icon to change (current: {priority})</span>
          </div>
        </SubSection>

        <SubSection title="Индикаторы статуса">
          <div classИмя="flex items-center gap-4 flex-wrap">
            {(["running", "active", "paused", "error", "archived"] as const).map((label) => (
              <div key={label} classИмя="flex items-center gap-2">
                <span classИмя="relative flex h-2.5 w-2.5">
                  <span classИмя={`inline-flex h-full w-full rounded-full ${agentСтатусDot[label] ?? agentСтатусDotПо умолчанию}`} />
                </span>
                <span classИмя="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </SubSection>

        <SubSection title="Запустить invocation badges">
          <div classИмя="flex items-center gap-2 flex-wrap">
            {[
              ["timer", "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"],
              ["assignment", "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"],
              ["on_demand", "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300"],
              ["automation", "bg-muted text-muted-foreground"],
            ].map(([label, cls]) => (
              <span key={label} classИмя={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
                {label}
              </span>
            ))}
          </div>
        </SubSection>

        <SubSection title="ЗадачаReferencePill">
          <p classИмя="text-xs text-muted-foreground">
            Used wherever a task is referenced — in markdown, the Related Работа tab, and activity summaries.
            Pass <code classИмя="font-mono">status</code> to show the target issue&apos;s state at a glance.
            Use <code classИмя="font-mono">strikethrough</code> for &quot;removed&quot; contexts.
          </p>
          <div classИмя="flex items-center gap-2 flex-wrap">
            <ЗадачаReferencePill issue={{ id: "demo-1", identifier: "PAP-123", title: "Identifier only — no status yet" }} />
            <ЗадачаReferencePill issue={{ id: "demo-2", identifier: "PAP-456", title: "With in_progress status", status: "in_progress" }} />
            <ЗадачаReferencePill issue={{ id: "demo-3", identifier: "PAP-789", title: "Готово status", status: "done" }} />
            <ЗадачаReferencePill issue={{ id: "demo-4", identifier: "PAP-101", title: "Заблокирован status", status: "blocked" }} />
            <ЗадачаReferencePill strikethrough issue={{ id: "demo-5", identifier: "PAP-202", title: "Удалитьd (strikethrough)", status: "todo" }} />
          </div>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  FORM ELEMENTS                                                */}
      {/* ============================================================ */}
      <Section title="Form Elements">
        <div classИмя="grid gap-6 md:grid-cols-2">
          <SubSection title="Input">
            <Input placeholder="По умолчанию input" />
            <Input placeholder="Отключитьd input" disabled classИмя="mt-2" />
          </SubSection>

          <SubSection title="Textarea">
            <Textarea placeholder="Write something..." />
          </SubSection>

          <SubSection title="Checkbox & Label">
            <div classИмя="space-y-3">
              <div classИмя="flex items-center gap-2">
                <Checkbox id="check1" defaultChecked />
                <Label htmlFor="check1">Checked item</Label>
              </div>
              <div classИмя="flex items-center gap-2">
                <Checkbox id="check2" />
                <Label htmlFor="check2">Unchecked item</Label>
              </div>
              <div classИмя="flex items-center gap-2">
                <Checkbox id="check3" disabled />
                <Label htmlFor="check3">Отключитьd item</Label>
              </div>
            </div>
          </SubSection>

          <SubSection title="Inline Изменитьor">
            <div classИмя="space-y-4">
              <div>
                <p classИмя="text-xs text-muted-foreground mb-1">Название (single-line)</p>
                <InlineИзменитьor
                  value={inlineНазвание}
                  onСохранить={setInlineНазвание}
                  as="h2"
                  classИмя="text-xl font-bold"
                />
              </div>
              <div>
                <p classИмя="text-xs text-muted-foreground mb-1">Body text (single-line)</p>
                <InlineИзменитьor
                  value={inlineText}
                  onСохранить={setInlineText}
                  as="p"
                  classИмя="text-sm"
                />
              </div>
              <div>
                <p classИмя="text-xs text-muted-foreground mb-1">Описание (multiline, auto-sizing)</p>
                <InlineИзменитьor
                  value={inlineDesc}
                  onСохранить={setInlineDesc}
                  as="p"
                  classИмя="text-sm text-muted-foreground"
                  placeholder="Добавить a description..."
                  multiline
                />
              </div>
            </div>
          </SubSection>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  SELECT                                                       */}
      {/* ============================================================ */}
      <Section title="Select">
        <div classИмя="grid gap-6 md:grid-cols-2">
          <SubSection title="По умолчанию size">
            <Select value={selectЗначение} onЗначениеChange={setSelectЗначение}>
              <SelectTrigger classИмя="w-full">
                <SelectЗначение placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="backlog">Назадlog</SelectItem>
                <SelectItem value="todo">Todo</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="done">Готово</SelectItem>
              </SelectContent>
            </Select>
            <p classИмя="text-xs text-muted-foreground">Current value: {selectЗначение}</p>
          </SubSection>
          <SubSection title="Small trigger">
            <Select defaultЗначение="high">
              <SelectTrigger size="sm" classИмя="w-full">
                <SelectЗначение />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Критично</SelectItem>
                <SelectItem value="high">Высокий</SelectItem>
                <SelectItem value="medium">Средний</SelectItem>
                <SelectItem value="low">Низкий</SelectItem>
              </SelectContent>
            </Select>
          </SubSection>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  DROPDOWN MENU                                                */}
      {/* ============================================================ */}
      <Section title="Dropdown Menu">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Quick Actions
              <ChevronDown classИмя="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" classИмя="w-56">
            <DropdownMenuItem>
              <Check classИмя="h-4 w-4" />
              Mark as done
              <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <BookOpen classИмя="h-4 w-4" />
              Open docs
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={menuChecked}
              onCheckedChange={(value) => setMenuChecked(value === true)}
            >
              Watch issue
            </DropdownMenuCheckboxItem>
            <DropdownMenuItem variant="destructive">
              <Trash2 classИмя="h-4 w-4" />
              Удалить issue
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Section>

      {/* ============================================================ */}
      {/*  POPOVER                                                      */}
      {/* ============================================================ */}
      <Section title="Popover">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">Open Popover</Button>
          </PopoverTrigger>
          <PopoverContent classИмя="space-y-2">
            <p classИмя="text-sm font-medium">Агент heartbeat</p>
            <p classИмя="text-xs text-muted-foreground">
              Last run succeeded 24s ago. Далее timer run in 9m.
            </p>
            <Button size="xs">Wake now</Button>
          </PopoverContent>
        </Popover>
      </Section>

      {/* ============================================================ */}
      {/*  COLLAPSIBLE                                                  */}
      {/* ============================================================ */}
      <Section title="Collapsible">
        <Collapsible open={collapsibleOpen} onOpenChange={setCollapsibleOpen} classИмя="space-y-2">
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm">
              {collapsibleOpen ? "Hide" : "Show"} advanced filters
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent classИмя="rounded-md border border-border p-3">
            <div classИмя="space-y-2">
              <Label htmlFor="owner-filter">Владелец</Label>
              <Input id="owner-filter" placeholder="Фильтр by agent name" />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Section>

      {/* ============================================================ */}
      {/*  SHEET                                                        */}
      {/* ============================================================ */}
      <Section title="Sheet">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">Open Side Panel</Button>
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetНазвание>Задача Properties</SheetНазвание>
              <SheetОписание>Изменить metadata without leaving the current page.</SheetОписание>
            </SheetHeader>
            <div classИмя="space-y-4 px-4">
              <div classИмя="space-y-1">
                <Label htmlFor="sheet-title">Название</Label>
                <Input id="sheet-title" defaultЗначение="Improve onboarding docs" />
              </div>
              <div classИмя="space-y-1">
                <Label htmlFor="sheet-description">Описание</Label>
                <Textarea id="sheet-description" defaultЗначение="Capture setup pitfalls and screenshots." />
              </div>
            </div>
            <SheetFooter>
              <Button variant="outline">Отмена</Button>
              <Button>Сохранить</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </Section>

      {/* ============================================================ */}
      {/*  SCROLL AREA                                                  */}
      {/* ============================================================ */}
      <Section title="Scroll Area">
        <ScrollArea classИмя="h-36 rounded-md border border-border">
          <div classИмя="space-y-2 p-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} classИмя="rounded-md border border-border p-2 text-sm">
                Heartbeat run #{i + 1}: completed successfully
              </div>
            ))}
          </div>
        </ScrollArea>
      </Section>

      {/* ============================================================ */}
      {/*  COMMAND                                                      */}
      {/* ============================================================ */}
      <Section title="Команда (CMDK)">
        <div classИмя="rounded-md border border-border">
          <Команда>
            <КомандаInput placeholder="Тип a command or search..." />
            <КомандаList>
              <КомандаEmpty>Результаты не найдены.</КомандаEmpty>
              <КомандаGroup heading="Pages">
                <КомандаItem>
                  <LayoutПанель управления classИмя="h-4 w-4" />
                  Панель управления
                </КомандаItem>
                <КомандаItem>
                  <CircleDot classИмя="h-4 w-4" />
                  Задачи
                </КомандаItem>
              </КомандаGroup>
              <КомандаSeparator />
              <КомандаGroup heading="Actions">
                <КомандаItem>
                  <КомандаIcon classИмя="h-4 w-4" />
                  Open command palette
                </КомандаItem>
                <КомандаItem>
                  <Plus classИмя="h-4 w-4" />
                  Создать new issue
                </КомандаItem>
              </КомандаGroup>
            </КомандаList>
          </Команда>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  BREADCRUMB                                                   */}
      {/* ============================================================ */}
      <Section title="Breadcrumb">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Проекты</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Paperclip App</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Задача List</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </Section>

      {/* ============================================================ */}
      {/*  CARDS                                                        */}
      {/* ============================================================ */}
      <Section title="Cards">
        <SubSection title="Standard Card">
          <Card>
            <CardHeader>
              <CardНазвание>Card Название</CardНазвание>
              <CardОписание>Card description with supporting text.</CardОписание>
            </CardHeader>
            <CardContent>
              <p classИмя="text-sm">Card content goes here. This is the main body area.</p>
            </CardContent>
            <CardFooter classИмя="gap-2">
              <Button size="sm">Action</Button>
              <Button variant="outline" size="sm">Отмена</Button>
            </CardFooter>
          </Card>
        </SubSection>

        <SubSection title="Metric Cards">
          <div classИмя="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard icon={Бот} value={12} label="Активные агенты" description="+3 this week" />
            <MetricCard icon={CircleDot} value={48} label="Открытые задачи" />
            <MetricCard icon={DollarSign} value="$1,234" label="Monthly Cost" description="Under budget" />
            <MetricCard icon={Zap} value="99.9%" label="Uptime" />
          </div>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  TABS                                                         */}
      {/* ============================================================ */}
      <Section title="Tabs">
        <SubSection title="По умолчанию (pill) variant">
          <Tabs defaultЗначение="overview">
            <TabsList>
              <TabsTrigger value="overview">Обзор</TabsTrigger>
              <TabsTrigger value="runs">Запуститьs</TabsTrigger>
              <TabsTrigger value="config">Config</TabsTrigger>
              <TabsTrigger value="costs">Расходы</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <p classИмя="text-sm text-muted-foreground py-4">Обзор tab content.</p>
            </TabsContent>
            <TabsContent value="runs">
              <p classИмя="text-sm text-muted-foreground py-4">Запуститьs tab content.</p>
            </TabsContent>
            <TabsContent value="config">
              <p classИмя="text-sm text-muted-foreground py-4">Config tab content.</p>
            </TabsContent>
            <TabsContent value="costs">
              <p classИмя="text-sm text-muted-foreground py-4">Расходы tab content.</p>
            </TabsContent>
          </Tabs>
        </SubSection>

        <SubSection title="Line variant">
          <Tabs defaultЗначение="summary">
            <TabsList variant="line">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="details">Детали</TabsTrigger>
              <TabsTrigger value="comments">Комментарии</TabsTrigger>
            </TabsList>
            <TabsContent value="summary">
              <p classИмя="text-sm text-muted-foreground py-4">Summary content with underline tabs.</p>
            </TabsContent>
            <TabsContent value="details">
              <p classИмя="text-sm text-muted-foreground py-4">Детали content.</p>
            </TabsContent>
            <TabsContent value="comments">
              <p classИмя="text-sm text-muted-foreground py-4">Комментарии content.</p>
            </TabsContent>
          </Tabs>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  ENTITY ROWS                                                  */}
      {/* ============================================================ */}
      <Section title="Entity Rows">
        <div classИмя="border border-border rounded-md">
          <EntityRow
            leading={
              <>
                <СтатусIcon status="in_progress" />
                <ПриоритетIcon priority="high" />
              </>
            }
            identifier="PAP-001"
            title="Implement authentication flow"
            subtitle="Assigned to Агент Alpha"
            trailing={<СтатусBadge status="in_progress" />}
            onClick={() => {}}
          />
          <EntityRow
            leading={
              <>
                <СтатусIcon status="done" />
                <ПриоритетIcon priority="medium" />
              </>
            }
            identifier="PAP-002"
            title="Set up CI/CD pipeline"
            subtitle="Завершён 2 days ago"
            trailing={<СтатусBadge status="done" />}
            onClick={() => {}}
          />
          <EntityRow
            leading={
              <>
                <СтатусIcon status="todo" />
                <ПриоритетIcon priority="low" />
              </>
            }
            identifier="PAP-003"
            title="Write API documentation"
            trailing={<СтатусBadge status="todo" />}
            onClick={() => {}}
          />
          <EntityRow
            leading={
              <>
                <СтатусIcon status="blocked" />
                <ПриоритетIcon priority="critical" />
              </>
            }
            identifier="PAP-004"
            title="Deploy to production"
            subtitle="Заблокирован by PAP-001"
            trailing={<СтатусBadge status="blocked" />}
            selected
          />
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  FILTER BAR                                                   */}
      {/* ============================================================ */}
      <Section title="Фильтр Bar">
        <ФильтрBar
          filters={filters}
          onУдалить={(key) => setФильтрs((f) => f.filter((x) => x.key !== key))}
          onОчистить={() => setФильтрs([])}
        />
        {filters.length === 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setФильтрs([
                { key: "status", label: "Статус", value: "Активен" },
                { key: "priority", label: "Приоритет", value: "Высокий" },
              ])
            }
          >
            Сбросить filters
          </Button>
        )}
      </Section>

      {/* ============================================================ */}
      {/*  AVATARS                                                      */}
      {/* ============================================================ */}
      <Section title="Avatars">
        <SubSection title="Sizes">
          <div classИмя="flex items-center gap-3">
            <Avatar size="sm"><AvatarFallback>SM</AvatarFallback></Avatar>
            <Avatar><AvatarFallback>DF</AvatarFallback></Avatar>
            <Avatar size="lg"><AvatarFallback>LG</AvatarFallback></Avatar>
          </div>
        </SubSection>

        <SubSection title="Group">
          <AvatarGroup>
            <Avatar><AvatarFallback>A1</AvatarFallback></Avatar>
            <Avatar><AvatarFallback>A2</AvatarFallback></Avatar>
            <Avatar><AvatarFallback>A3</AvatarFallback></Avatar>
            <AvatarGroupCount>+5</AvatarGroupCount>
          </AvatarGroup>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  IDENTITY                                                     */}
      {/* ============================================================ */}
      <Section title="Identity">
        <SubSection title="Sizes">
          <div classИмя="flex items-center gap-6">
            <Identity name="Агент Alpha" size="sm" />
            <Identity name="Агент Alpha" />
            <Identity name="Агент Alpha" size="lg" />
          </div>
        </SubSection>

        <SubSection title="Initials derivation">
          <div classИмя="flex flex-col gap-2">
            <Identity name="Агент-CEO" size="sm" />
            <Identity name="Alpha" size="sm" />
            <Identity name="Quality Assurance Lead" size="sm" />
          </div>
        </SubSection>

        <SubSection title="Свой initials">
          <Identity name="Назадend Service" initials="BS" size="sm" />
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  TOOLTIPS                                                     */}
      {/* ============================================================ */}
      <Section title="Tooltips">
        <div classИмя="flex items-center gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm">Hover me</Button>
            </TooltipTrigger>
            <TooltipContent>This is a tooltip</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm"><Настройки /></Button>
            </TooltipTrigger>
            <TooltipContent>Настройки</TooltipContent>
          </Tooltip>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  DIALOG                                                       */}
      {/* ============================================================ */}
      <Section title="Dialog">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Open Dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogНазвание>Dialog Название</DialogНазвание>
              <DialogОписание>
                This is a sample dialog showing the standard layout with header, content, and footer.
              </DialogОписание>
            </DialogHeader>
            <div classИмя="space-y-3">
              <div>
                <Label>Имя</Label>
                <Input placeholder="Enter a name" classИмя="mt-1.5" />
              </div>
              <div>
                <Label>Описание</Label>
                <Textarea placeholder="Describe..." classИмя="mt-1.5" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline">Отмена</Button>
              <Button>Сохранить</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Section>

      {/* ============================================================ */}
      {/*  EMPTY STATE                                                  */}
      {/* ============================================================ */}
      <Section title="Empty State">
        <div classИмя="border border-border rounded-md">
          <EmptyState
            icon={Входящие}
            message="Нет items to show. Создать your first one to get started."
            action="Создать Item"
            onAction={() => {}}
          />
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  PROGRESS BARS                                                */}
      {/* ============================================================ */}
      <Section title="Progress Bars (Бюджет)">
        <div classИмя="space-y-3">
          {[
            { label: "Under budget (40%)", pct: 40, color: "bg-green-400" },
            { label: "Предупреждение (75%)", pct: 75, color: "bg-yellow-400" },
            { label: "Over budget (95%)", pct: 95, color: "bg-red-400" },
          ].map(({ label, pct, color }) => (
            <div key={label} classИмя="space-y-1">
              <div classИмя="flex items-center justify-between">
                <span classИмя="text-xs text-muted-foreground">{label}</span>
                <span classИмя="text-xs font-mono">{pct}%</span>
              </div>
              <div classИмя="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  classИмя={`h-full rounded-full transition-[width,background-color] duration-150 ${color}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  LOG VIEWER                                                   */}
      {/* ============================================================ */}
      <Section title="Log Viewer">
        <div classИмя="bg-neutral-950 rounded-lg p-3 font-mono text-xs max-h-80 overflow-y-auto">
          <div classИмя="text-foreground">[12:00:01] INFO  Агент started successfully</div>
          <div classИмя="text-foreground">[12:00:02] INFO  Processing task PAP-001</div>
          <div classИмя="text-yellow-400">[12:00:05] WARN  Rate limit approaching (80%)</div>
          <div classИмя="text-foreground">[12:00:08] INFO  Задача PAP-001 completed</div>
          <div classИмя="text-red-400">[12:00:12] ERROR Connection timeout to upstream service</div>
          <div classИмя="text-blue-300">[12:00:12] SYS   Повторитьing connection in 5s...</div>
          <div classИмя="text-foreground">[12:00:17] INFO  Reconnected successfully</div>
          <div classИмя="flex items-center gap-1.5">
            <span classИмя="relative flex h-1.5 w-1.5">
              <span classИмя="absolute inline-flex h-full w-full rounded-full bg-cyan-400 animate-pulse" />
              <span classИмя="inline-flex h-full w-full rounded-full bg-cyan-400" />
            </span>
            <span classИмя="text-cyan-400">Live</span>
          </div>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  PROPERTY ROW PATTERN                                         */}
      {/* ============================================================ */}
      <Section title="Property Row Pattern">
        <div classИмя="border border-border rounded-md p-4 space-y-1 max-w-sm">
          <div classИмя="flex items-center justify-between py-1.5">
            <span classИмя="text-xs text-muted-foreground">Статус</span>
            <СтатусBadge status="active" />
          </div>
          <div classИмя="flex items-center justify-between py-1.5">
            <span classИмя="text-xs text-muted-foreground">Приоритет</span>
            <ПриоритетIcon priority="high" />
          </div>
          <div classИмя="flex items-center justify-between py-1.5">
            <span classИмя="text-xs text-muted-foreground">Исполнитель</span>
            <div classИмя="flex items-center gap-1.5">
              <Avatar size="sm"><AvatarFallback>A</AvatarFallback></Avatar>
              <span classИмя="text-xs">Агент Alpha</span>
            </div>
          </div>
          <div classИмя="flex items-center justify-between py-1.5">
            <span classИмя="text-xs text-muted-foreground">Создано</span>
            <span classИмя="text-xs">Jan 15, 2025</span>
          </div>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  NAVIGATION PATTERNS                                          */}
      {/* ============================================================ */}
      <Section title="Navigation Patterns">
        <SubSection title="Sidebar nav items">
          <div classИмя="w-60 border border-border rounded-md p-3 space-y-0.5 bg-card">
            <div classИмя="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-accent-foreground">
              <LayoutПанель управления classИмя="h-4 w-4" />
              Панель управления
            </div>
            <div classИмя="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground cursor-pointer">
              <CircleDot classИмя="h-4 w-4" />
              Задачи
              <span classИмя="ml-auto text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
                12
              </span>
            </div>
            <div classИмя="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground cursor-pointer">
              <Бот classИмя="h-4 w-4" />
              Агенты
            </div>
            <div classИмя="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground cursor-pointer">
              <Hexagon classИмя="h-4 w-4" />
              Проекты
            </div>
          </div>
        </SubSection>

        <SubSection title="View toggle">
          <div classИмя="flex items-center border border-border rounded-md w-fit">
            <button classИмя="px-3 py-1.5 text-xs font-medium bg-accent text-foreground rounded-l-md">
              <ListTodo classИмя="h-3.5 w-3.5 inline mr-1" />
              List
            </button>
            <button classИмя="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent/50 rounded-r-md">
              <Цель classИмя="h-3.5 w-3.5 inline mr-1" />
              Оргструктура
            </button>
          </div>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  GROUPED LIST (Задачи pattern)                                */}
      {/* ============================================================ */}
      <Section title="Grouped List (Задачи pattern)">
        <div>
          <div classИмя="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-t-md">
            <СтатусIcon status="in_progress" />
            <span classИмя="text-sm font-medium">In Progress</span>
            <span classИмя="text-xs text-muted-foreground ml-1">2</span>
          </div>
          <div classИмя="border border-border rounded-b-md">
            <EntityRow
              leading={<ПриоритетIcon priority="high" />}
              identifier="PAP-101"
              title="Build agent heartbeat system"
              onClick={() => {}}
            />
            <EntityRow
              leading={<ПриоритетIcon priority="medium" />}
              identifier="PAP-102"
              title="Добавить cost tracking dashboard"
              onClick={() => {}}
            />
          </div>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  COMMENT THREAD PATTERN                                       */}
      {/* ============================================================ */}
      <Section title="Comment Thread Pattern">
        <div classИмя="space-y-3 max-w-2xl">
          <h3 classИмя="text-sm font-semibold">Комментарии (2)</h3>
          <div classИмя="space-y-3">
            <div classИмя="rounded-md border border-border p-3">
              <div classИмя="flex items-center justify-between mb-1">
                <span classИмя="text-xs font-medium text-muted-foreground">Агент</span>
                <span classИмя="text-xs text-muted-foreground">Jan 15, 2025</span>
              </div>
              <p classИмя="text-sm">Запущен working on the authentication module. Will need API keys configured.</p>
            </div>
            <div classИмя="rounded-md border border-border p-3">
              <div classИмя="flex items-center justify-between mb-1">
                <span classИмя="text-xs font-medium text-muted-foreground">Человек</span>
                <span classИмя="text-xs text-muted-foreground">Jan 16, 2025</span>
              </div>
              <p classИмя="text-sm">API keys have been added to the vault. Please proceed.</p>
            </div>
          </div>
          <div classИмя="space-y-2">
            <Textarea placeholder="Leave a comment..." rows={3} />
            <Button size="sm">Comment</Button>
          </div>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  COST TABLE PATTERN                                           */}
      {/* ============================================================ */}
      <Section title="Cost Table Pattern">
        <div classИмя="border border-border rounded-lg overflow-hidden">
          <table classИмя="w-full text-xs">
            <thead classИмя="border-b border-border bg-accent/20">
              <tr>
                <th classИмя="text-left px-3 py-2 font-medium text-muted-foreground">Модель</th>
                <th classИмя="text-left px-3 py-2 font-medium text-muted-foreground">Токенs</th>
                <th classИмя="text-left px-3 py-2 font-medium text-muted-foreground">Cost</th>
              </tr>
            </thead>
            <tbody>
              <tr classИмя="border-b border-border">
                <td classИмя="px-3 py-2">claude-sonnet-4-20250514</td>
                <td classИмя="px-3 py-2 font-mono">1.2M</td>
                <td classИмя="px-3 py-2 font-mono">$18.00</td>
              </tr>
              <tr classИмя="border-b border-border">
                <td classИмя="px-3 py-2">claude-haiku-4-20250506</td>
                <td classИмя="px-3 py-2 font-mono">500k</td>
                <td classИмя="px-3 py-2 font-mono">$1.25</td>
              </tr>
              <tr>
                <td classИмя="px-3 py-2 font-medium">Total</td>
                <td classИмя="px-3 py-2 font-mono">1.7M</td>
                <td classИмя="px-3 py-2 font-mono font-medium">$19.25</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  SKELETONS                                                    */}
      {/* ============================================================ */}
      <Section title="Skeletons">
        <SubSection title="Individual">
          <div classИмя="space-y-2">
            <Skeleton classИмя="h-4 w-48" />
            <Skeleton classИмя="h-8 w-full max-w-sm" />
            <Skeleton classИмя="h-20 w-full" />
          </div>
        </SubSection>

        <SubSection title="Page Skeleton (list)">
          <div classИмя="border border-border rounded-md p-4">
            <PageSkeleton variant="list" />
          </div>
        </SubSection>

        <SubSection title="Page Skeleton (detail)">
          <div classИмя="border border-border rounded-md p-4">
            <PageSkeleton variant="detail" />
          </div>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  SEPARATOR                                                    */}
      {/* ============================================================ */}
      <Section title="Separator">
        <div classИмя="space-y-4">
          <p classИмя="text-sm text-muted-foreground">Horizontal</p>
          <Separator />
          <div classИмя="flex items-center gap-4 h-8">
            <span classИмя="text-sm">Left</span>
            <Separator orientation="vertical" />
            <span classИмя="text-sm">Right</span>
          </div>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  ICON REFERENCE                                               */}
      {/* ============================================================ */}
      <Section title="Common Icons (Lucide)">
        <div classИмя="grid grid-cols-4 md:grid-cols-6 gap-4">
          {[
            ["Входящие", Входящие],
            ["ListTodo", ListTodo],
            ["CircleDot", CircleDot],
            ["Hexagon", Hexagon],
            ["Цель", Цель],
            ["LayoutПанель управления", LayoutПанель управления],
            ["Бот", Бот],
            ["DollarSign", DollarSign],
            ["История", История],
            ["Поиск", Поиск],
            ["Plus", Plus],
            ["Trash2", Trash2],
            ["Настройки", Настройки],
            ["User", User],
            ["Mail", Mail],
            ["Загрузить", Загрузить],
            ["Zap", Zap],
          ].map(([name, Icon]) => {
            const LucideIcon = Icon as React.FC<{ classИмя?: string }>;
            return (
              <div key={name as string} classИмя="flex flex-col items-center gap-1.5 p-2">
                <LucideIcon classИмя="h-4 w-4 text-muted-foreground" />
                <span classИмя="text-[10px] text-muted-foreground font-mono">{name as string}</span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  KEYBOARD SHORTCUTS                                           */}
      {/* ============================================================ */}
      <Section title="Ключboard Shortcuts">
        <div classИмя="border border-border rounded-md divide-y divide-border text-sm">
          {[
            ["Cmd+K / Ctrl+K", "Open Команда Palette"],
            ["C", "Новая задача (outside inputs)"],
            ["[", "Toggle Sidebar"],
            ["]", "Toggle Properties Panel"],

            ["Cmd+Enter / Ctrl+Enter", "Отправить markdown comment"],
          ].map(([key, desc]) => (
            <div key={key} classИмя="flex items-center justify-between px-4 py-2">
              <span classИмя="text-muted-foreground">{desc}</span>
              <kbd classИмя="px-2 py-0.5 text-xs font-mono bg-muted rounded border border-border">
                {key}
              </kbd>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
