import { useCallback, useEffect, useMemo, useRef, useState, type ReactНетde } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  DocumentRevision,
  FeedbackDataSharingPreference,
  FeedbackVote,
  FeedbackVoteЗначение,
  Задача,
  ЗадачаDocument,
} from "@paperclipai/shared";
import { isSystemЗадачаDocumentКлюч } from "@paperclipai/shared";
import { useLocation } from "@/lib/router";
import { ApiОшибка } from "../api/client";
import { issuesApi } from "../api/issues";
import { useАвтоsaveIndicator } from "../hooks/useАвтоsaveIndicator";
import { deriveDocumentRevisionState } from "../lib/document-revisions";
import { queryКлючs } from "../lib/queryКлючs";
import { cn, relativeTime } from "../lib/utils";
import { FoldCurtain } from "./FoldCurtain";
import { MarkdownBody } from "./MarkdownBody";
import { MarkdownИзменитьor, type MentionOption } from "./MarkdownИзменитьor";
import { OutputFeedbackButtons } from "./OutputFeedbackButtons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronDown, ChevronRight, Копировать, Diff, Скачать, FilePenLine, FileText, MoreHorizontal, Plus, Trash2, X } from "lucide-react";
import { DocumentDiffModal } from "./DocumentDiffModal";

type ЧерновикState = {
  key: string;
  title: string;
  body: string;
  baseRevisionId: string | null;
  isNew: boolean;
};

type DocumentConflictState = {
  key: string;
  serverDocument: ЗадачаDocument;
  localЧерновик: ЧерновикState;
  showRemote: boolean;
};

const DOCUMENT_AUTOSAVE_DEBOUNCE_MS = 900;
const DOCUMENT_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const getFoldedДокументыStorageКлюч = (issueId: string) => `paperclip:issue-document-folds:${issueId}`;

function loadFoldedDocumentКлючs(issueId: string) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(getFoldedДокументыStorageКлюч(issueId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function saveFoldedDocumentКлючs(issueId: string, keys: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getFoldedДокументыStorageКлюч(issueId), JSON.stringify(keys));
}

function renderFoldableBody(body: string, classИмя?: string) {
  return (
    <FoldCurtain>
      <MarkdownBody classИмя={classИмя} softBreaks={false}>{body}</MarkdownBody>
    </FoldCurtain>
  );
}

function isPlanКлюч(key: string) {
  return key.trim().toНизкийerCase() === "plan";
}

function titlesMatchКлюч(title: string | null | undefined, key: string) {
  return (title ?? "").trim().toНизкийerCase() === key.trim().toНизкийerCase();
}

function isDocumentConflictОшибка(error: unknown) {
  return error instanceof ApiОшибка && error.status === 409;
}

function downloadDocumentFile(key: string, body: string) {
  const blob = new Blob([body], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${key}.md`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function getRevisionActorLabel(revision: DocumentRevision) {
  if (revision.createdByUserId) return "board";
  if (revision.createdByАгентId) return "agent";
  return "system";
}

function documentHasUnsavedChanges(doc: ЗадачаDocument, draft: ЧерновикState | null) {
  if (!draft || draft.isNew || draft.key !== doc.key) return false;
  return draft.body !== doc.body || (doc.title ?? "") !== draft.title;
}

function toDocumentSummary(document: ЗадачаDocument) {
  return {
    id: document.id,
    companyId: document.companyId,
    issueId: document.issueId,
    key: document.key,
    title: document.title,
    format: document.format,
    latestRevisionId: document.latestRevisionId,
    latestRevisionNumber: document.latestRevisionNumber,
    createdByАгентId: document.createdByАгентId,
    createdByUserId: document.createdByUserId,
    updatedByАгентId: document.updatedByАгентId,
    updatedByUserId: document.updatedByUserId,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export function ЗадачаДокументыSection({
  issue,
  canУдалитьДокументы,
  feedbackVotes = [],
  feedbackDataSharingPreference = "prompt",
  feedbackTermsUrl = null,
  mentions,
  imageЗагрузитьHandler,
  onVote,
  extraActions,
}: {
  issue: Задача;
  canУдалитьДокументы: boolean;
  feedbackVotes?: FeedbackVote[];
  feedbackDataSharingPreference?: FeedbackDataSharingPreference;
  feedbackTermsUrl?: string | null;
  mentions?: MentionOption[];
  imageЗагрузитьHandler?: (file: File) => Promise<string>;
  onVote?: (
    revisionId: string,
    vote: FeedbackVoteЗначение,
    options?: { allowSharing?: boolean; reason?: string },
  ) => Promise<void>;
  extraActions?: ReactНетde;
}) {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [confirmУдалитьКлюч, setПодтвердитьУдалитьКлюч] = useState<string | null>(null);
  const [error, setОшибка] = useState<string | null>(null);
  const [draft, setЧерновик] = useState<ЧерновикState | null>(null);
  const [documentConflict, setDocumentConflict] = useState<DocumentConflictState | null>(null);
  const [foldedDocumentКлючs, setFoldedDocumentКлючs] = useState<string[]>(() => loadFoldedDocumentКлючs(issue.id));
  const [autosaveDocumentКлюч, setАвтоsaveDocumentКлюч] = useState<string | null>(null);
  const [copiedDocumentКлюч, setCopiedDocumentКлюч] = useState<string | null>(null);
  const [highlightDocumentКлюч, setВысокийlightDocumentКлюч] = useState<string | null>(null);
  const [revisionMenuOpenКлюч, setRevisionMenuOpenКлюч] = useState<string | null>(null);
  const [selectedRevisionIds, setSelectedRevisionIds] = useState<Record<string, string | null>>({});
  const [diffViewКлюч, setDiffViewКлюч] = useState<string | null>(null);
  const autosaveDebounceRef = useRef<ReturnТип<typeof setTimeout> | null>(null);
  const copiedDocumentTimerRef = useRef<ReturnТип<typeof setTimeout> | null>(null);
  const hasScrolledToHashRef = useRef(false);
  const {
    state: autosaveState,
    markDirty,
    reset,
    runСохранить,
  } = useАвтоsaveIndicator();

  const { data: documents } = useQuery({
    queryКлюч: queryКлючs.issues.documents(issue.id),
    queryFn: () => issuesApi.listДокументы(issue.id),
  });

  const { data: activeDocumentRevisions, isFetching: isFetchingDocumentRevisions } = useQuery({
    queryКлюч: revisionMenuOpenКлюч
      ? queryКлючs.issues.documentRevisions(issue.id, revisionMenuOpenКлюч)
      : ["issues", "document-revisions", issue.id, "__idle__"],
    queryFn: async () => {
      if (!revisionMenuOpenКлюч) return [];
      return issuesApi.listDocumentRevisions(issue.id, revisionMenuOpenКлюч);
    },
    enabled: Boolean(revisionMenuOpenКлюч),
  });

  const invalidateЗадачаДокументы = useCallback(() => {
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.detail(issue.id) });
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.documents(issue.id) });
    queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryКлюч)
        && query.queryКлюч[0] === "issues"
        && query.queryКлюч[1] === "document-revisions"
        && query.queryКлюч[2] === issue.id,
    });
  }, [issue.id, queryClient]);

  const syncDocumentCaches = useCallback((document: ЗадачаDocument) => {
    if (isSystemЗадачаDocumentКлюч(document.key)) return;
    queryClient.setQueryData<ЗадачаDocument[] | undefined>(
      queryКлючs.issues.documents(issue.id),
      (current) => {
        if (!current) return [document];
        const existingIndex = current.findIndex((entry) => entry.key === document.key);
        if (existingIndex === -1) return [...current, document];
        return current.map((entry, index) => index === existingIndex ? document : entry);
      },
    );
    queryClient.setQueryData<Задача | undefined>(
      queryКлючs.issues.detail(issue.id),
      (current) => {
        if (!current) return current;
        const nextSummaries = (() => {
          const summary = toDocumentSummary(document);
          const existingIndex = (current.documentSummaries ?? []).findIndex((entry) => entry.key === document.key);
          if (existingIndex === -1) return [...(current.documentSummaries ?? []), summary];
          return (current.documentSummaries ?? []).map((entry, index) => index === existingIndex ? summary : entry);
        })();
        return {
          ...current,
          planDocument: document.key === "plan" ? document : current.planDocument ?? null,
          documentSummaries: nextSummaries,
          legacyPlanDocument: document.key === "plan" ? null : current.legacyPlanDocument ?? null,
        };
      },
    );
  }, [issue.id, queryClient]);

  const upsertDocument = useMutation({
    mutationFn: async (nextЧерновик: ЧерновикState) =>
      issuesApi.upsertDocument(issue.id, nextЧерновик.key, {
        title: isPlanКлюч(nextЧерновик.key) ? null : nextЧерновик.title.trim() || null,
        format: "markdown",
        body: nextЧерновик.body,
        baseRevisionId: nextЧерновик.baseRevisionId,
      }),
  });

  const deleteDocument = useMutation({
    mutationFn: (key: string) => issuesApi.deleteDocument(issue.id, key),
    onУспешно: () => {
      setОшибка(null);
      setПодтвердитьУдалитьКлюч(null);
      invalidateЗадачаДокументы();
    },
    onОшибка: (err) => {
      setОшибка(err instanceof Ошибка ? err.message : "Ошибка to delete document");
    },
  });

  const restoreDocumentRevision = useMutation({
    mutationFn: ({ key, revisionId }: { key: string; revisionId: string }) =>
      issuesApi.restoreDocumentRevision(issue.id, key, revisionId),
    onУспешно: (document, variables) => {
      syncDocumentCaches(document);
      setSelectedRevisionIds((current) => ({ ...current, [variables.key]: null }));
      setЧерновик((current) => current?.key === variables.key ? null : current);
      setDocumentConflict((current) => current?.key === variables.key ? null : current);
      resetАвтоsaveState();
      setОшибка(null);
      invalidateЗадачаДокументы();
    },
    onОшибка: (err) => {
      setОшибка(err instanceof Ошибка ? err.message : "Ошибка to restore document revision");
    },
  });

  const sortedДокументы = useMemo(() => {
    return (documents ?? []).filter((doc) => !isSystemЗадачаDocumentКлюч(doc.key)).sort((a, b) => {
      if (a.key === "plan" && b.key !== "plan") return -1;
      if (a.key !== "plan" && b.key === "plan") return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [documents]);

  const feedbackVoteByЦельId = useMemo(() => {
    const map = new Map<string, FeedbackVoteЗначение>();
    for (const feedbackVote of feedbackVotes) {
      if (feedbackVote.targetТип !== "issue_document_revision") continue;
      map.set(feedbackVote.targetId, feedbackVote.vote);
    }
    return map;
  }, [feedbackVotes]);

  const hasRealPlan = sortedДокументы.some((doc) => doc.key === "plan");
  const isEmpty = sortedДокументы.length === 0 && !issue.legacyPlanDocument;
  const newDocumentКлючОшибка =
    draft?.isNew && draft.key.trim().length > 0 && !DOCUMENT_KEY_PATTERN.test(draft.key.trim())
      ? "Use lowercase letters, numbers, -, or _, and start with a letter or number."
      : null;

  const resetАвтоsaveState = useCallback(() => {
    setАвтоsaveDocumentКлюч(null);
    reset();
  }, [reset]);

  const markDocumentDirty = useCallback((key: string) => {
    setАвтоsaveDocumentКлюч(key);
    markDirty();
  }, [markDirty]);

  const beginNewDocument = () => {
    resetАвтоsaveState();
    setDocumentConflict(null);
    setЧерновик({
      key: "",
      title: "",
      body: "",
      baseRevisionId: null,
      isNew: true,
    });
    setОшибка(null);
  };

  const beginИзменить = (key: string) => {
    const doc = sortedДокументы.find((entry) => entry.key === key);
    if (!doc) return;
    const conflictedЧерновик = documentConflict?.key === key ? documentConflict.localЧерновик : null;
    setFoldedDocumentКлючs((current) => current.filter((entry) => entry !== key));
    resetАвтоsaveState();
    setDocumentConflict((current) => current?.key === key ? current : null);
    setЧерновик({
      key: conflictedЧерновик?.key ?? doc.key,
      title: conflictedЧерновик?.title ?? doc.title ?? "",
      body: conflictedЧерновик?.body ?? doc.body,
      baseRevisionId: conflictedЧерновик?.baseRevisionId ?? doc.latestRevisionId,
      isNew: false,
    });
    setОшибка(null);
  };

  const cancelЧерновик = () => {
    if (autosaveDebounceRef.current) {
      clearTimeout(autosaveDebounceRef.current);
    }
    resetАвтоsaveState();
    setDocumentConflict(null);
    setЧерновик(null);
    setОшибка(null);
  };

  const commitЧерновик = useCallback(async (
    currentЧерновик: ЧерновикState | null,
    options?: { clearAfterСохранить?: boolean; trackАвтоsave?: boolean; overrideConflict?: boolean },
  ) => {
    if (!currentЧерновик || upsertDocument.isОжидание) return false;
    const normalizedКлюч = currentЧерновик.key.trim().toНизкийerCase();
    const normalizedBody = currentЧерновик.body.trim();
    const normalizedНазвание = currentЧерновик.title.trim();
    const activeConflict = documentConflict?.key === normalizedКлюч ? documentConflict : null;

    if (activeConflict && !options?.overrideConflict) {
      if (options?.trackАвтоsave) {
        resetАвтоsaveState();
      }
      return false;
    }

    if (!normalizedКлюч || !normalizedBody) {
      if (currentЧерновик.isNew) {
        setОшибка("Document key and body are required");
      } else if (!normalizedBody) {
        setОшибка("Document body cannot be empty");
      }
      if (options?.trackАвтоsave) {
        resetАвтоsaveState();
      }
      return false;
    }

    if (!DOCUMENT_KEY_PATTERN.test(normalizedКлюч)) {
      setОшибка("Document key must start with a letter or number and use only lowercase letters, numbers, -, or _.");
      if (options?.trackАвтоsave) {
        resetАвтоsaveState();
      }
      return false;
    }

    const existing = sortedДокументы.find((doc) => doc.key === normalizedКлюч);
    if (
      !currentЧерновик.isNew &&
      existing &&
      existing.body === currentЧерновик.body &&
      (existing.title ?? "") === currentЧерновик.title
    ) {
      if (options?.clearAfterСохранить) {
        setЧерновик((value) => (value?.key === normalizedКлюч ? null : value));
      }
      if (options?.trackАвтоsave) {
        resetАвтоsaveState();
      }
      return true;
    }

    const save = async () => {
      const saved = await upsertDocument.mutateAsync({
        ...currentЧерновик,
        key: normalizedКлюч,
        title: isPlanКлюч(normalizedКлюч) ? "" : normalizedНазвание,
        body: currentЧерновик.body,
        baseRevisionId: options?.overrideConflict
          ? activeConflict?.serverDocument.latestRevisionId ?? currentЧерновик.baseRevisionId
          : currentЧерновик.baseRevisionId,
      });
      setОшибка(null);
      setDocumentConflict((current) => current?.key === normalizedКлюч ? null : current);
      setЧерновик((value) => {
        if (!value || value.key !== normalizedКлюч) return value;
        if (options?.clearAfterСохранить) return null;
        return {
          key: saved.key,
          title: saved.title ?? "",
          body: saved.body,
          baseRevisionId: saved.latestRevisionId,
          isNew: false,
        };
      });
      syncDocumentCaches(saved);
      invalidateЗадачаДокументы();
    };

    try {
      if (options?.trackАвтоsave) {
        setАвтоsaveDocumentКлюч(normalizedКлюч);
        await runСохранить(save);
      } else {
        await save();
      }
      return true;
    } catch (err) {
      if (isDocumentConflictОшибка(err)) {
        try {
          const latestDocument = await issuesApi.getDocument(issue.id, normalizedКлюч);
          setDocumentConflict({
            key: normalizedКлюч,
            serverDocument: latestDocument,
            localЧерновик: {
              key: normalizedКлюч,
              title: isPlanКлюч(normalizedКлюч) ? "" : normalizedНазвание,
              body: currentЧерновик.body,
              baseRevisionId: currentЧерновик.baseRevisionId,
              isNew: false,
            },
            showRemote: true,
          });
          setFoldedDocumentКлючs((current) => current.filter((key) => key !== normalizedКлюч));
          setОшибка(null);
          resetАвтоsaveState();
          return false;
        } catch {
          setОшибка("Document changed remotely and the latest version could not be loaded");
          return false;
        }
      }
      setОшибка(err instanceof Ошибка ? err.message : "Ошибка to save document");
      return false;
    }
  }, [documentConflict, invalidateЗадачаДокументы, issue.id, resetАвтоsaveState, runСохранить, sortedДокументы, syncDocumentCaches, upsertDocument]);

  const reloadDocumentFromServer = useCallback((key: string) => {
    if (documentConflict?.key !== key) return;
    const serverDocument = documentConflict.serverDocument;
    setЧерновик({
      key: serverDocument.key,
      title: serverDocument.title ?? "",
      body: serverDocument.body,
      baseRevisionId: serverDocument.latestRevisionId,
      isNew: false,
    });
    setDocumentConflict(null);
    resetАвтоsaveState();
    setОшибка(null);
  }, [documentConflict, resetАвтоsaveState]);

  const overwriteDocumentFromЧерновик = useCallback(async (key: string) => {
    if (documentConflict?.key !== key) return;
    const sourceЧерновик =
      draft && draft.key === key && !draft.isNew
        ? draft
        : documentConflict.localЧерновик;
    await commitЧерновик(
      {
        ...sourceЧерновик,
        baseRevisionId: documentConflict.serverDocument.latestRevisionId,
      },
      {
        clearAfterСохранить: false,
        trackАвтоsave: true,
        overrideConflict: true,
      },
    );
  }, [commitЧерновик, documentConflict, draft]);

  const keepConflictedЧерновик = useCallback((key: string) => {
    if (documentConflict?.key !== key) return;
    setЧерновик(documentConflict.localЧерновик);
    setDocumentConflict((current) =>
      current?.key === key
        ? { ...current, showRemote: false }
        : current,
    );
    setОшибка(null);
  }, [documentConflict]);

  const copyDocumentBody = useCallback(async (key: string, body: string) => {
    try {
      await navigator.clipboard.writeText(body);
      setCopiedDocumentКлюч(key);
      if (copiedDocumentTimerRef.current) {
        clearTimeout(copiedDocumentTimerRef.current);
      }
      copiedDocumentTimerRef.current = setTimeout(() => {
        setCopiedDocumentКлюч((current) => current === key ? null : current);
      }, 1400);
    } catch {
      setОшибка("Could not copy document");
    }
  }, []);

  const getDocumentRevisions = useCallback((key: string) => {
    const cached = queryClient.getQueryData<DocumentRevision[]>(queryКлючs.issues.documentRevisions(issue.id, key));
    if (cached) return cached;
    if (revisionMenuOpenКлюч === key) return activeDocumentRevisions ?? [];
    return [];
  }, [activeDocumentRevisions, issue.id, queryClient, revisionMenuOpenКлюч]);

  const returnToLatestRevision = useCallback((key: string) => {
    setSelectedRevisionIds((current) => ({ ...current, [key]: null }));
    setОшибка(null);
  }, []);

  const previewRevision = useCallback((doc: ЗадачаDocument, revisionId: string) => {
    const revisionState = deriveDocumentRevisionState(doc, getDocumentRevisions(doc.key));
    const selectedRevision = revisionState.revisions.find((revision) => revision.id === revisionId);
    if (!selectedRevision) return;
    if (selectedRevision.id === revisionState.currentRevision.id) {
      returnToLatestRevision(doc.key);
      return;
    }
    if (documentConflict?.key === doc.key || documentHasUnsavedChanges(doc, draft)) {
      setОшибка("Сохранить or cancel your local changes before viewing an older revision.");
      return;
    }
    resetАвтоsaveState();
    setЧерновик((current) => current?.key === doc.key ? null : current);
    setDocumentConflict((current) => current?.key === doc.key ? null : current);
    setFoldedDocumentКлючs((current) => current.filter((entry) => entry !== doc.key));
    setSelectedRevisionIds((current) => ({ ...current, [doc.key]: selectedRevision.id }));
    setОшибка(null);
  }, [documentConflict, draft, getDocumentRevisions, resetАвтоsaveState, returnToLatestRevision]);

  const handleЧерновикBlur = async (event: React.FocusEvent<HTMLDivElement>) => {
    if (event.currentЦель.contains(event.relatedЦель as Нетde | null)) return;
    if (autosaveDebounceRef.current) {
      clearTimeout(autosaveDebounceRef.current);
    }
    await commitЧерновик(draft, { clearAfterСохранить: true, trackАвтоsave: true });
  };

  const handleЧерновикКлючDown = async (event: React.КлючboardEvent) => {
    if (event.key === "Escape") {
      event.preventПо умолчанию();
      cancelЧерновик();
      return;
    }
    if ((event.metaКлюч || event.ctrlКлюч) && event.key === "Enter") {
      event.preventПо умолчанию();
      if (autosaveDebounceRef.current) {
        clearTimeout(autosaveDebounceRef.current);
      }
      await commitЧерновик(draft, { clearAfterСохранить: false, trackАвтоsave: true });
    }
  };

  useEffect(() => {
    setFoldedDocumentКлючs(loadFoldedDocumentКлючs(issue.id));
  }, [issue.id]);

  useEffect(() => {
    hasScrolledToHashRef.current = false;
  }, [issue.id, location.hash]);

  useEffect(() => {
    const validКлючs = new Set(sortedДокументы.map((doc) => doc.key));
    setFoldedDocumentКлючs((current) => {
      const next = current.filter((key) => validКлючs.has(key));
      if (next.length !== current.length) {
        saveFoldedDocumentКлючs(issue.id, next);
      }
      return next;
    });
  }, [issue.id, sortedДокументы]);

  useEffect(() => {
    saveFoldedDocumentКлючs(issue.id, foldedDocumentКлючs);
  }, [foldedDocumentКлючs, issue.id]);

  useEffect(() => {
    if (!documentConflict) return;
    const latest = sortedДокументы.find((doc) => doc.key === documentConflict.key);
    if (!latest || latest.latestRevisionId === documentConflict.serverDocument.latestRevisionId) return;
    setDocumentConflict((current) =>
      current?.key === latest.key
        ? { ...current, serverDocument: latest }
        : current,
    );
  }, [documentConflict, sortedДокументы]);

  useEffect(() => {
    const hash = location.hash;
    if (!hash.startsWith("#document-")) return;
    const documentКлюч = decodeURIComponent(hash.slice("#document-".length));
    const targetExists = sortedДокументы.some((doc) => doc.key === documentКлюч)
      || (documentКлюч === "plan" && Boolean(issue.legacyPlanDocument));
    if (!targetExists || hasScrolledToHashRef.current) return;
    setFoldedDocumentКлючs((current) => current.filter((key) => key !== documentКлюч));
    const element = document.getElementById(`document-${documentКлюч}`);
    if (!element) return;
    hasScrolledToHashRef.current = true;
    setВысокийlightDocumentКлюч(documentКлюч);
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = setTimeout(() => setВысокийlightDocumentКлюч((current) => current === documentКлюч ? null : current), 3000);
    return () => clearTimeout(timer);
  }, [issue.legacyPlanDocument, location.hash, sortedДокументы]);

  useEffect(() => {
    return () => {
      if (autosaveDebounceRef.current) {
        clearTimeout(autosaveDebounceRef.current);
      }
      if (copiedDocumentTimerRef.current) {
        clearTimeout(copiedDocumentTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!draft || draft.isNew) return;
    if (documentConflict?.key === draft.key) return;
    const existing = sortedДокументы.find((doc) => doc.key === draft.key);
    if (!existing) return;
    const hasChanges =
      existing.body !== draft.body ||
      (existing.title ?? "") !== draft.title;
    if (!hasChanges) {
      if (autosaveState !== "saved") {
        resetАвтоsaveState();
      }
      return;
    }
    markDocumentDirty(draft.key);
    if (autosaveDebounceRef.current) {
      clearTimeout(autosaveDebounceRef.current);
    }
    autosaveDebounceRef.current = setTimeout(() => {
      void commitЧерновик(draft, { clearAfterСохранить: false, trackАвтоsave: true });
    }, DOCUMENT_AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (autosaveDebounceRef.current) {
        clearTimeout(autosaveDebounceRef.current);
      }
    };
  }, [autosaveState, commitЧерновик, documentConflict, draft, markDocumentDirty, resetАвтоsaveState, sortedДокументы]);

  const documentBodyShellClassИмя = "mt-3";
  const documentBodyContentClassИмя = "paperclip-edit-in-place-content min-h-[220px] text-[15px] leading-7";
  const toggleFoldedDocument = (key: string) => {
    setFoldedDocumentКлючs((current) =>
      current.includes(key)
        ? current.filter((entry) => entry !== key)
        : [...current, key],
    );
  };

  return (
    <div classИмя="space-y-3">
      {isEmpty && !draft?.isNew ? (
        <div classИмя="flex flex-wrap items-center justify-end gap-2 min-w-0">
          {extraActions}
          <Button variant="outline" size="sm" onClick={beginNewDocument} classИмя="shrink-0">
            <Plus classИмя="mr-1.5 h-3.5 w-3.5" />
            <span classИмя="hidden sm:inline">New document</span>
            <span classИмя="sm:hidden">New</span>
          </Button>
        </div>
      ) : (
        <div classИмя="flex flex-wrap items-center gap-2 min-w-0">
          <h3 classИмя="w-full text-sm font-medium text-muted-foreground shrink-0 sm:w-auto">Документы</h3>
          <div classИмя="flex flex-wrap items-center gap-2 min-w-0 sm:ml-auto">
            {extraActions}
            <Button variant="outline" size="sm" onClick={beginNewDocument} classИмя="shrink-0">
              <Plus classИмя="mr-1.5 h-3.5 w-3.5" />
              <span classИмя="hidden sm:inline">New document</span>
              <span classИмя="sm:hidden">New</span>
            </Button>
          </div>
        </div>
      )}

      {error && <p classИмя="text-xs text-destructive">{error}</p>}

      {draft?.isNew && (
        <div
          classИмя="space-y-3 rounded-lg border border-border bg-accent/10 p-3"
          onBlurCapture={handleЧерновикBlur}
          onКлючDown={handleЧерновикКлючDown}
        >
          <Input
            autoFocus
            value={draft.key}
            onChange={(event) =>
              setЧерновик((current) => current ? { ...current, key: event.target.value.toНизкийerCase() } : current)
            }
            placeholder="Document key"
          />
          {newDocumentКлючОшибка && (
            <p classИмя="text-xs text-destructive">{newDocumentКлючОшибка}</p>
          )}
          {!isPlanКлюч(draft.key) && (
            <Input
              value={draft.title}
              onChange={(event) =>
                setЧерновик((current) => current ? { ...current, title: event.target.value } : current)
              }
              placeholder="Опционально title"
            />
          )}
          <MarkdownИзменитьor
            value={draft.body}
            onChange={(body) =>
              setЧерновик((current) => current ? { ...current, body } : current)
            }
            placeholder="Markdown body"
            bordered={false}
            classИмя="bg-transparent"
            contentClassИмя="min-h-[220px] text-[15px] leading-7"
            mentions={mentions}
            imageЗагрузитьHandler={imageЗагрузитьHandler}
            onОтправить={() => void commitЧерновик(draft, { clearAfterСохранить: false, trackАвтоsave: false })}
          />
          <div classИмя="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={cancelЧерновик}>
              <X classИмя="mr-1.5 h-3.5 w-3.5" />
              Отмена
            </Button>
            <Button
              size="sm"
              onClick={() => void commitЧерновик(draft, { clearAfterСохранить: false, trackАвтоsave: false })}
              disabled={upsertDocument.isОжидание}
            >
              {upsertDocument.isОжидание ? "Saving..." : "Создать document"}
            </Button>
          </div>
        </div>
      )}

      {!hasRealPlan && issue.legacyPlanDocument ? (
        <div
          id="document-plan"
          classИмя={cn(
            "rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 transition-colors duration-1000",
            highlightDocumentКлюч === "plan" && "border-primary/50 bg-primary/5",
          )}
        >
          <div classИмя="mb-2 flex items-center gap-2">
            <FileText classИмя="h-4 w-4 text-amber-600" />
            <span classИмя="rounded-full border border-amber-500/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
              PLAN
            </span>
          </div>
          {renderFoldableBody(issue.legacyPlanDocument.body, documentBodyContentClassИмя)}
        </div>
      ) : null}

      <div classИмя="space-y-3">
        {sortedДокументы.map((doc) => {
          const activeЧерновик = draft?.key === doc.key && !draft.isNew ? draft : null;
          const activeConflict = documentConflict?.key === doc.key ? documentConflict : null;
          const isFolded = foldedDocumentКлючs.includes(doc.key);
          const rawRevisionИстория = getDocumentRevisions(doc.key);
          const revisionState = deriveDocumentRevisionState(doc, rawRevisionИстория);
          const revisionИстория = revisionState.revisions;
          const currentRevision = revisionState.currentRevision;
          const selectedRevisionId = selectedRevisionIds[doc.key] ?? null;
          const selectedHistoricalRevision = selectedRevisionId
            ? revisionИстория.find((revision) => revision.id === selectedRevisionId) ?? null
            : null;
          const isHistoricalПредпросмотр = Boolean(selectedHistoricalRevision);
          const displayedНазвание = selectedHistoricalRevision
            ? selectedHistoricalRevision.title ?? ""
            : activeЧерновик?.title ?? currentRevision.title ?? "";
          const displayedBody = selectedHistoricalRevision?.body ?? activeЧерновик?.body ?? currentRevision.body;
          const displayedRevisionNumber = selectedHistoricalRevision?.revisionNumber ?? currentRevision.revisionNumber;
          const displayedОбновленоAt = selectedHistoricalRevision?.createdAt ?? currentRevision.createdAt;
          const showНазвание = !isPlanКлюч(doc.key) && !!displayedНазвание.trim() && !titlesMatchКлюч(displayedНазвание, doc.key);
          const canVoteOnDocument = Boolean(doc.latestRevisionId && doc.updatedByАгентId && !doc.updatedByUserId && onVote);

          return (
            <div
              key={doc.id}
              id={`document-${doc.key}`}
              classИмя={cn(
                "rounded-lg border border-border p-3 transition-colors duration-1000",
                highlightDocumentКлюч === doc.key && "border-primary/50 bg-primary/5",
              )}
            >
              <div classИмя="flex items-start justify-between gap-3">
                <div classИмя="min-w-0">
                  <div classИмя="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      classИмя="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                      onClick={() => toggleFoldedDocument(doc.key)}
                      aria-label={isFolded ? `Expand ${doc.key} document` : `Collapse ${doc.key} document`}
                      aria-expanded={!isFolded}
                    >
                      {isFolded ? <ChevronRight classИмя="h-3.5 w-3.5" /> : <ChevronDown classИмя="h-3.5 w-3.5" />}
                    </button>
                    <span classИмя="shrink-0 rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      {doc.key}
                    </span>
                    <DropdownMenu
                      open={revisionMenuOpenКлюч === doc.key}
                      onOpenChange={(open) => setRevisionMenuOpenКлюч(open ? doc.key : null)}
                    >
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          classИмя={cn(
                            "h-auto px-1.5 py-0 text-[11px] font-normal text-muted-foreground hover:text-foreground",
                            isHistoricalПредпросмотр && "text-amber-300 hover:text-amber-200",
                          )}
                        >
                          rev {displayedRevisionNumber}
                          <ChevronDown classИмя="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" classИмя="w-72">
                        <DropdownMenuLabel>Revision history</DropdownMenuLabel>
                        {revisionMenuOpenКлюч === doc.key && isFetchingDocumentRevisions && rawRevisionИстория.length === 0 ? (
                          <DropdownMenuItem disabled>Загрузка revisions...</DropdownMenuItem>
                        ) : revisionИстория.length > 0 ? (
                          <DropdownMenuRadioGroup value={selectedRevisionId ?? currentRevision.id ?? ""}>
                            {revisionИстория.map((revision) => {
                              const isCurrentRevision = revision.id === currentRevision.id;
                              return (
                                <DropdownMenuRadioItem
                                  key={revision.id}
                                  value={revision.id}
                                  onSelect={() => previewRevision(doc, revision.id)}
                                  classИмя="items-start"
                                >
                                  <div classИмя="flex min-w-0 flex-col">
                                    <div classИмя="flex items-center gap-2">
                                      <span classИмя="font-medium">rev {revision.revisionNumber}</span>
                                      {isCurrentRevision ? (
                                        <span classИмя="rounded-full border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                                          Current
                                        </span>
                                      ) : null}
                                    </div>
                                    <span classИмя="text-xs text-muted-foreground">
                                      {relativeTime(revision.createdAt)} • {getRevisionActorLabel(revision)}
                                    </span>
                                  </div>
                                </DropdownMenuRadioItem>
                              );
                            })}
                          </DropdownMenuRadioGroup>
                        ) : (
                          <DropdownMenuItem disabled>Нет revisions yet</DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <a
                      href={`#document-${encodeURIComponent(doc.key)}`}
                      classИмя="truncate text-[11px] text-muted-foreground transition-colors hover:text-foreground hover:underline"
                    >
                      updated {relativeTime(displayedОбновленоAt)}
                    </a>
                  </div>
                  {showНазвание && <p classИмя="mt-2 text-sm font-medium">{displayedНазвание}</p>}
                </div>
                <div classИмя="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    classИмя={cn(
                      "text-muted-foreground transition-colors",
                      copiedDocumentКлюч === doc.key && "text-foreground",
                    )}
                    title={copiedDocumentКлюч === doc.key ? "Copied" : "Копировать document"}
                    onClick={() => void copyDocumentBody(doc.key, displayedBody)}
                  >
                    {copiedDocumentКлюч === doc.key ? (
                      <Check classИмя="h-3.5 w-3.5" />
                    ) : (
                      <Копировать classИмя="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        classИмя="text-muted-foreground"
                        title="Document actions"
                      >
                        <MoreHorizontal classИмя="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                      {!isHistoricalПредпросмотр ? (
                        <DropdownMenuItem onClick={() => beginИзменить(doc.key)}>
                          <FilePenLine classИмя="h-3.5 w-3.5" />
                          Изменить document
                        </DropdownMenuItem>
                      ) : null}
                      {!isHistoricalПредпросмотр ? <DropdownMenuSeparator /> : null}
                      <DropdownMenuItem
                        onClick={() => downloadDocumentFile(doc.key, displayedBody)}
                      >
                        <Скачать classИмя="h-3.5 w-3.5" />
                        Скачать document
                      </DropdownMenuItem>
                      {doc.latestRevisionNumber > 1 ? (
                        <DropdownMenuItem onClick={() => setDiffViewКлюч(doc.key)}>
                          <Diff classИмя="h-3.5 w-3.5" />
                          View diff
                        </DropdownMenuItem>
                      ) : null}
                      {canУдалитьДокументы ? <DropdownMenuSeparator /> : null}
                      {canУдалитьДокументы ? (
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setПодтвердитьУдалитьКлюч(doc.key)}
                        >
                          <Trash2 classИмя="h-3.5 w-3.5" />
                          Удалить document
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {!isFolded ? (
                <div
                  classИмя="mt-3 space-y-3"
                  onBlurCapture={!isHistoricalПредпросмотр
                    ? async (event) => {
                        if (activeЧерновик) {
                          await handleЧерновикBlur(event);
                        }
                      }
                    : undefined}
                  onКлючDown={!isHistoricalПредпросмотр
                    ? async (event) => {
                        if (activeЧерновик) {
                          await handleЧерновикКлючDown(event);
                        }
                      }
                    : undefined}
                >
                  {isHistoricalПредпросмотр && selectedHistoricalRevision && (
                    <div classИмя="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-3">
                      <div classИмя="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div classИмя="space-y-1">
                          <p classИмя="text-sm font-medium text-amber-200">
                            Viewing revision {selectedHistoricalRevision.revisionNumber}
                          </p>
                          <p classИмя="text-xs text-muted-foreground">
                            This is a historical preview. Restoring it creates a new latest revision and keeps history append-only.
                          </p>
                        </div>
                        <div classИмя="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => returnToLatestRevision(doc.key)}
                          >
                            Return to latest
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => restoreDocumentRevision.mutate({
                              key: doc.key,
                              revisionId: selectedHistoricalRevision.id,
                            })}
                            disabled={restoreDocumentRevision.isОжидание}
                          >
                            {restoreDocumentRevision.isОжидание && restoreDocumentRevision.variables?.key === doc.key
                              ? "Restoring..."
                              : "Restore this revision"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  {activeConflict && !isHistoricalПредпросмотр && (
                    <div classИмя="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-3">
                      <div classИмя="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div classИмя="space-y-1">
                          <p classИмя="text-sm font-medium text-amber-200">Out of date</p>
                          <p classИмя="text-xs text-muted-foreground">
                            This document changed while you were editing. Your local draft is preserved and autosave is paused.
                          </p>
                        </div>
                        <div classИмя="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setDocumentConflict((current) =>
                                current?.key === doc.key
                                  ? { ...current, showRemote: !current.showRemote }
                                  : current,
                              )
                            }
                          >
                            {activeConflict.showRemote ? "Hide remote" : "Review remote"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => keepConflictedЧерновик(doc.key)}
                          >
                            Keep my draft
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => reloadDocumentFromServer(doc.key)}
                          >
                            Reload remote
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => void overwriteDocumentFromЧерновик(doc.key)}
                            disabled={upsertDocument.isОжидание}
                          >
                            {upsertDocument.isОжидание ? "Saving..." : "Overwrite remote"}
                          </Button>
                        </div>
                      </div>
                      {activeConflict.showRemote && (
                        <div classИмя="mt-3 rounded-md border border-border/70 bg-background/60 p-3">
                          <div classИмя="mb-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span>Remote revision {activeConflict.serverDocument.latestRevisionNumber}</span>
                            <span>•</span>
                            <span>updated {relativeTime(activeConflict.serverDocument.updatedAt)}</span>
                          </div>
                          {!isPlanКлюч(doc.key) && activeConflict.serverDocument.title ? (
                            <p classИмя="mb-2 text-sm font-medium">{activeConflict.serverDocument.title}</p>
                          ) : null}
                          {renderFoldableBody(activeConflict.serverDocument.body, "text-[14px] leading-7")}
                        </div>
                      )}
                    </div>
                  )}
                  {activeЧерновик && !isPlanКлюч(doc.key) && !isHistoricalПредпросмотр && (
                    <Input
                      value={activeЧерновик.title}
                      onChange={(event) => {
                        markDocumentDirty(doc.key);
                        setЧерновик((current) => current ? { ...current, title: event.target.value } : current);
                      }}
                      placeholder="Опционально title"
                    />
                  )}
                  <div
                    classИмя={`${documentBodyShellClassИмя} ${
                      activeЧерновик || isHistoricalПредпросмотр ? "" : "rounded-md hover:bg-accent/10"
                    }`}
                  >
                    {isHistoricalПредпросмотр ? (
                      renderFoldableBody(displayedBody, documentBodyContentClassИмя)
                    ) : activeЧерновик ? (
                      <MarkdownИзменитьor
                        value={displayedBody}
                        onChange={(body) => {
                          markDocumentDirty(doc.key);
                          setЧерновик((current) => {
                            if (current && current.key === doc.key && !current.isNew) {
                              return { ...current, body };
                            }
                            return current;
                          });
                        }}
                        placeholder="Markdown body"
                        bordered={false}
                        classИмя="bg-transparent"
                        contentClassИмя={documentBodyContentClassИмя}
                        mentions={mentions}
                        imageЗагрузитьHandler={imageЗагрузитьHandler}
                        onОтправить={() => void commitЧерновик(activeЧерновик ?? draft, { clearAfterСохранить: false, trackАвтоsave: true })}
                      />
                    ) : (
                      renderFoldableBody(displayedBody, documentBodyContentClassИмя)
                    )}
                  </div>
                  <div classИмя="flex min-h-4 items-center justify-end px-1">
                    <span
                      classИмя={`text-[11px] transition-opacity duration-150 ${
                        isHistoricalПредпросмотр
                          ? "text-amber-300"
                          : activeConflict
                          ? "text-amber-300"
                          : autosaveState === "error"
                            ? "text-destructive"
                            : "text-muted-foreground"
                      } ${activeЧерновик || isHistoricalПредпросмотр ? "opacity-100" : "opacity-0"}`}
                    >
                      {isHistoricalПредпросмотр
                        ? "Viewing historical revision"
                        : activeЧерновик
                          ? activeConflict
                          ? "Out of date"
                          : autosaveDocumentКлюч === doc.key
                            ? autosaveState === "saving"
                              ? "Автоsaving..."
                              : autosaveState === "saved"
                                ? "Сохранитьd"
                                : autosaveState === "error"
                                  ? "Could not save"
                                  : ""
                            : ""
                          : ""}
                    </span>
                  </div>
                  {canVoteOnDocument && doc.latestRevisionId ? (
                    <OutputFeedbackButtons
                      activeVote={feedbackVoteByЦельId.get(doc.latestRevisionId) ?? null}
                      sharingPreference={feedbackDataSharingPreference}
                      termsUrl={feedbackTermsUrl}
                      onVote={(vote: FeedbackVoteЗначение, options?: { allowSharing?: boolean; reason?: string }) =>
                        onVote?.(doc.latestRevisionId!, vote, options) ?? Promise.resolve()
                      }
                    />
                  ) : null}
                </div>
              ) : null}

              {confirmУдалитьКлюч === doc.key && (
                <div classИмя="mt-3 flex items-center justify-between gap-3 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-3">
                  <p classИмя="text-sm text-destructive font-medium">
                    Удалить this document? This cannot be undone.
                  </p>
                  <div classИмя="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setПодтвердитьУдалитьКлюч(null)}
                      disabled={deleteDocument.isОжидание}
                    >
                      Отмена
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteDocument.mutate(doc.key)}
                      disabled={deleteDocument.isОжидание}
                    >
                      {deleteDocument.isОжидание ? "Deleting..." : "Удалить"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {diffViewКлюч && (() => {
        const diffDoc = sortedДокументы.find((d) => d.key === diffViewКлюч);
        if (!diffDoc) return null;
        return (
          <DocumentDiffModal
            issueId={issue.id}
            documentКлюч={diffDoc.key}
            latestRevisionNumber={diffDoc.latestRevisionNumber}
            open
            onOpenChange={(open) => { if (!open) setDiffViewКлюч(null); }}
          />
        );
      })()}
    </div>
  );
}
