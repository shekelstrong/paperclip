import { useEffect, useRef, useState, type ReactНетde } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardОписание, CardHeader, CardНазвание } from "@/components/ui/card";
import { ЗадачаChatThread } from "../components/ЗадачаChatThread";
import {
  issueChatUxАгентMap,
  issueChatUxFeedbackVotes,
  issueChatUxLinkedЗапуститьs,
  issueChatUxLiveКомментарии,
  issueChatUxLiveEvents,
  issueChatUxLiveЗапуститьs,
  issueChatUxMentions,
  issueChatUxReassignOptions,
  issueChatUxReviewКомментарии,
  issueChatUxReviewEvents,
  issueChatUxОтправитьtingКомментарии,
  issueChatUxTranscriptsByЗапуститьId,
} from "../fixtures/issueChatUxFixtures";
import { cn } from "../lib/utils";
import { Бот, Brain, FlaskConical, Loader2, MessagesSquare, Route, Sparkles, WandSparkles } from "lucide-react";

const noop = async () => {};

const highlights = [
  "Выполняется assistant replies with streamed text, reasoning, tool cards, and background status notes",
  "Historical issue events and linked runs rendered inline with the chat timeline",
  "Queued user messages, settled assistant comments, and feedback controls",
  "Отправитьting (pending) message bubble with Отправитьing... label and reduced opacity",
  "Empty and disabled-composer states without relying on live backend data",
];

function LabSection({
  id,
  eyebrow,
  title,
  description,
  accentClassИмя,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description: string;
  accentClassИмя?: string;
  children: ReactНетde;
}) {
  return (
    <section
      id={id}
      classИмя={cn(
        "rounded-[28px] border border-border/70 bg-background/80 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.08)] sm:p-5",
        accentClassИмя,
      )}
    >
      <div classИмя="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div classИмя="min-w-0">
          <div classИмя="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {eyebrow}
          </div>
          <h2 classИмя="mt-1 text-xl font-semibold tracking-tight">{title}</h2>
          <p classИмя="mt-2 max-w-3xl text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

const DEMO_REASONING_LINES = [
  "Analyzing the user's request about the animation smoothness...",
  "The current implementation unmounts the old span instantly, causing a flash...",
  "Looking at the CSS keyframes for cot-line-slide-up...",
  "We need a paired exit animation so the old line slides out while the new one slides in...",
  "Implementing a two-span ticker: exiting line goes up and out, entering line comes up from below...",
  "Проверитьing the 280ms cubic-bezier transition timing...",
];

function RotatingReasoningDemo({ intervalMs = 2200 }: { intervalMs?: number }) {
  const [index, setIndex] = useState(0);
  const prevRef = useRef(DEMO_REASONING_LINES[0]);
  const [ticker, setTicker] = useState<{
    key: number;
    current: string;
    exiting: string | null;
  }>({ key: 0, current: DEMO_REASONING_LINES[0], exiting: null });

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % DEMO_REASONING_LINES.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  const currentLine = DEMO_REASONING_LINES[index];

  useEffect(() => {
    if (currentLine !== prevRef.current) {
      const prev = prevRef.current;
      prevRef.current = currentLine;
      setTicker((t) => ({ key: t.key + 1, current: currentLine, exiting: prev }));
    }
  }, [currentLine]);

  return (
    <div classИмя="flex gap-2 px-1">
      <div classИмя="flex flex-col items-center pt-0.5">
        <Brain classИмя="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
      </div>
      <div classИмя="relative h-5 min-w-0 flex-1 overflow-hidden">
        {ticker.exiting !== null && (
          <span
            key={`out-${ticker.key}`}
            classИмя="cot-line-exit absolute inset-x-0 truncate text-[13px] italic leading-5 text-muted-foreground/70"
            onAnimationEnd={() => setTicker((t) => ({ ...t, exiting: null }))}
          >
            {ticker.exiting}
          </span>
        )}
        <span
          key={`in-${ticker.key}`}
          classИмя={cn(
            "absolute inset-x-0 truncate text-[13px] italic leading-5 text-muted-foreground/70",
            ticker.key > 0 && "cot-line-enter",
          )}
        >
          {ticker.current}
        </span>
      </div>
    </div>
  );
}

export function ЗадачаChatUxLab() {
  const [showComposer, setShowComposer] = useState(true);

  return (
    <div classИмя="space-y-6">
      <div classИмя="overflow-hidden rounded-[32px] border border-border/70 bg-[linear-gradient(135deg,rgba(8,145,178,0.10),transparent_28%),linear-gradient(180deg,rgba(245,158,11,0.10),transparent_44%),var(--background)] shadow-[0_30px_80px_rgba(15,23,42,0.10)]">
        <div classИмя="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_320px]">
          <div classИмя="p-6 sm:p-7">
            <div classИмя="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/[0.08] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-700 dark:text-cyan-300">
              <FlaskConical classИмя="h-3.5 w-3.5" />
              Chat UX Lab
            </div>
            <h1 classИмя="mt-4 text-3xl font-semibold tracking-tight">Задача chat review surface</h1>
            <p classИмя="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              This page exercises the real assistant-ui issue chat with fixture-backed messages. Use it to review
              spacing, chronology, running states, tool rendering, activity rows, queueing, and composer behavior
              without needing a live issue in progress.
            </p>

            <div classИмя="mt-5 flex flex-wrap items-center gap-2">
              <Badge variant="outline" classИмя="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em]">
                /tests/ux/chat
              </Badge>
              <Badge variant="outline" classИмя="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em]">
                assistant-ui thread
              </Badge>
              <Badge variant="outline" classИмя="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em]">
                fixture-backed live run
              </Badge>
            </div>

            <div classИмя="mt-6 flex flex-wrap items-center gap-3">
              <Button variant="outline" size="sm" classИмя="rounded-full" onClick={() => setShowComposer((value) => !value)}>
                {showComposer ? "Hide composer in primary preview" : "Show composer in primary preview"}
              </Button>
              <a
                href="#live-execution"
                classИмя="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <Route classИмя="h-3.5 w-3.5" />
                Jump to live execution preview
              </a>
            </div>
          </div>

          <aside classИмя="border-t border-border/60 bg-background/70 p-6 lg:border-l lg:border-t-0">
            <div classИмя="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              <WandSparkles classИмя="h-4 w-4 text-cyan-700 dark:text-cyan-300" />
              Covered states
            </div>
            <div classИмя="space-y-3">
              {highlights.map((highlight) => (
                <div
                  key={highlight}
                  classИмя="rounded-2xl border border-border/70 bg-background/85 px-4 py-3 text-sm text-muted-foreground"
                >
                  {highlight}
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>

      <LabSection
        id="rotating-text"
        eyebrow="Animation demo"
        title="Rotating reasoning text"
        description="Isolated ticker that cycles sample reasoning lines on a timer. The outgoing line slides up and fades out while the incoming line slides up from below. Запуститьs in a loop so you can tune timing and easing without needing a live stream."
        accentClassИмя="bg-[linear-gradient(180deg,rgba(168,85,247,0.06),transparent_28%),var(--background)]"
      >
        <div classИмя="space-y-4">
          <div classИмя="rounded-xl border border-border/60 bg-accent/10 p-4">
            <div classИмя="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              По умолчанию interval (2.2s)
            </div>
            <RotatingReasoningDemo />
          </div>
          <div classИмя="rounded-xl border border-border/60 bg-accent/10 p-4">
            <div classИмя="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Fast interval (1s) — stress test
            </div>
            <RotatingReasoningDemo intervalMs={1000} />
          </div>
        </div>
      </LabSection>

      <LabSection
        id="working-tokens"
        eyebrow="Статус tokens"
        title="Работаing / Работаed header verb"
        description='The "Работаing" token uses the shimmer-text gradient sweep to signal an active run. Once the run completes it becomes the static "Работаed" token.'
        accentClassИмя="bg-[linear-gradient(180deg,rgba(16,185,129,0.06),transparent_28%),var(--background)]"
      >
        <div classИмя="grid gap-4 sm:grid-cols-2">
          <div classИмя="rounded-xl border border-border/60 bg-accent/10 p-4">
            <div classИмя="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Активен run — shimmer
            </div>
            <div classИмя="flex items-center gap-2.5 rounded-lg px-1 py-2">
              <span classИмя="inline-flex items-center gap-2 text-sm font-medium text-foreground/80">
                <Loader2 classИмя="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                <span classИмя="shimmer-text">Работаing</span>
              </span>
              <span classИмя="text-xs text-muted-foreground/60">for 12s</span>
            </div>
          </div>
          <div classИмя="rounded-xl border border-border/60 bg-accent/10 p-4">
            <div classИмя="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Завершён run — static
            </div>
            <div classИмя="flex items-center gap-2.5 rounded-lg px-1 py-2">
              <span classИмя="inline-flex items-center gap-2 text-sm font-medium text-foreground/80">
                <span classИмя="flex h-4 w-4 shrink-0 items-center justify-center">
                  <span classИмя="h-1.5 w-1.5 rounded-full bg-emerald-500/70" />
                </span>
                Работаed
              </span>
              <span classИмя="text-xs text-muted-foreground/60">for 1 min 24s</span>
            </div>
          </div>
        </div>
      </LabSection>

      <LabSection
        id="live-execution"
        eyebrow="Primary preview"
        title="Live execution thread"
        description="Shows the fully active state: timeline events, historical run marker, a running assistant reply with reasoning and tools, and a queued follow-up from the user."
        accentClassИмя="bg-[linear-gradient(180deg,rgba(6,182,212,0.05),transparent_28%),var(--background)]"
      >
        <ЗадачаChatThread
          comments={issueChatUxLiveКомментарии}
          linkedЗапуститьs={issueChatUxLinkedЗапуститьs.slice(0, 1)}
          timelineEvents={issueChatUxLiveEvents}
          liveЗапуститьs={issueChatUxLiveЗапуститьs}
          issueСтатус="todo"
          agentMap={issueChatUxАгентMap}
          currentUserId="user-1"
          onДобавить={noop}
          onVote={noop}
          onОтменаЗапустить={noop}
          onInterruptQueued={noop}
          draftКлюч="issue-chat-ux-lab-primary"
          enableReassign
          reassignOptions={issueChatUxReassignOptions}
          currentИсполнительЗначение="agent:agent-1"
          suggestedИсполнительЗначение="agent:agent-2"
          mentions={issueChatUxMentions}
          showComposer={showComposer}
          enableLiveTranscriptPolling={false}
          transcriptsByЗапуститьId={issueChatUxTranscriptsByЗапуститьId}
          hasOutputForЗапустить={(runId) => issueChatUxTranscriptsByЗапуститьId.has(runId)}
        />
      </LabSection>

      <LabSection
        eyebrow="Отправитьting state"
        title="Ожидание message bubble"
        description='When a user sends a message, the bubble briefly shows a "Отправитьing..." label at reduced opacity until the server confirms receipt. This preview renders that transient state.'
        accentClassИмя="bg-[linear-gradient(180deg,rgba(59,130,246,0.06),transparent_28%),var(--background)]"
      >
        <ЗадачаChatThread
          comments={issueChatUxОтправитьtingКомментарии}
          linkedЗапуститьs={[]}
          timelineEvents={[]}
          issueСтатус="in_progress"
          agentMap={issueChatUxАгентMap}
          currentUserId="user-1"
          onДобавить={noop}
          draftКлюч="issue-chat-ux-lab-submitting"
          showComposer={false}
          enableLiveTranscriptPolling={false}
        />
      </LabSection>

      <div classИмя="grid gap-6 xl:grid-cols-2">
        <LabSection
          eyebrow="Settled review"
          title="Durable comments and feedback"
          description="Shows the post-run state: assistant comment feedback controls, historical run context, and timeline reassignment without any active stream."
          accentClassИмя="bg-[linear-gradient(180deg,rgba(168,85,247,0.05),transparent_26%),var(--background)]"
        >
          <ЗадачаChatThread
            comments={issueChatUxReviewКомментарии}
            linkedЗапуститьs={issueChatUxLinkedЗапуститьs.slice(1)}
            timelineEvents={issueChatUxReviewEvents}
            feedbackVotes={issueChatUxFeedbackVotes}
            feedbackTermsUrl="/feedback-terms"
            issueСтатус="in_review"
            agentMap={issueChatUxАгентMap}
            currentUserId="user-1"
            onДобавить={noop}
            onVote={noop}
            draftКлюч="issue-chat-ux-lab-review"
            showComposer={false}
            enableLiveTranscriptPolling={false}
          />
        </LabSection>

        <div classИмя="space-y-6">
          <LabSection
            eyebrow="Empty thread"
            title="Empty state and disabled composer"
            description="Keeps the message area visible even when there is no thread yet, and replaces the composer with an explicit warning when replies are blocked."
            accentClassИмя="bg-[linear-gradient(180deg,rgba(245,158,11,0.08),transparent_26%),var(--background)]"
          >
            <ЗадачаChatThread
              comments={[]}
              linkedЗапуститьs={[]}
              timelineEvents={[]}
              issueСтатус="done"
              agentMap={issueChatUxАгентMap}
              currentUserId="user-1"
              onДобавить={noop}
              composerОтключитьdReason="This workspace is closed, so new chat replies are disabled until the issue is reopened."
              draftКлюч="issue-chat-ux-lab-empty"
              enableLiveTranscriptPolling={false}
            />
          </LabSection>

          <Card classИмя="gap-4 border-border/70 bg-background/85 py-0">
            <CardHeader classИмя="px-5 pt-5 pb-0">
              <div classИмя="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <MessagesSquare classИмя="h-4 w-4 text-cyan-700 dark:text-cyan-300" />
                Review checklist
              </div>
              <CardНазвание classИмя="text-lg">What to evaluate on this page</CardНазвание>
              <CardОписание>
                This route should be the fastest way to inspect the chat system before or after tweaks.
              </CardОписание>
            </CardHeader>
            <CardContent classИмя="space-y-3 px-5 pb-5 pt-0 text-sm text-muted-foreground">
              <div classИмя="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
                <div classИмя="mb-1 flex items-center gap-2 font-medium text-foreground">
                  <Бот classИмя="h-4 w-4 text-cyan-700 dark:text-cyan-300" />
                  Message hierarchy
                </div>
                Check that user, assistant, and system rows scan differently without feeling like separate products.
              </div>
              <div classИмя="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
                <div classИмя="mb-1 flex items-center gap-2 font-medium text-foreground">
                  <Sparkles classИмя="h-4 w-4 text-cyan-700 dark:text-cyan-300" />
                  Stream polish
                </div>
                Watch the live preview for reasoning density, tool expansion behavior, and queued follow-up readability.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
