"use client";

import {
  ArrowLeft01Icon,
  Link04Icon,
  LinkSquare02Icon,
  PlayIcon,
  StopIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@notra/ui/components/ui/button";
import { Label } from "@notra/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import { Switch } from "@notra/ui/components/ui/switch";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { DeleteReportDialog } from "@/components/geo-reports/delete-report-dialog";
import { GeoReportDocument } from "@/components/geo-reports/geo-report-document";
import {
  GEO_AUTOSAVE_DEBOUNCE_MS,
  GEO_DEFAULT_SECTION_STATE,
  GEO_MODELS,
  GEO_REPORT_SECTIONS,
  GEO_STATUS_LABELS,
} from "@/constants/geo-report";
import { EXAMPLE_GEO_REPORT } from "@/constants/geo-report-example";
import { saveGeoReportAction } from "@/lib/geo-reports/actions";
import {
  applyRecommendations,
  applyScanCell,
  applyScanSummary,
  type GeoScanCell,
  runGeoScan,
} from "@/lib/geo-reports/scan";
import type {
  GeoRecommendation,
  GeoReport,
  GeoReportEditorProps,
  GeoReportSectionState,
  GeoReportStatus,
  GeoReportUpdater,
  GeoSavedReport,
  GeoSaveState,
  GeoScanProgress,
} from "@/types/geo-report";
import { buildGeoSharePath } from "@/utils/geo-report";

import { EditorSection } from "./editor-primitives";
import {
  CompanySection,
  CompetitorsSection,
  ModelsSection,
  PromptsSection,
} from "./editor-sections";

const PREVIEW_ZOOM = 0.72;
const PERCENT = 100;
const STATUSES: GeoReportStatus[] = ["draft", "ready", "sent"];

const SAVE_STATE_LABELS: Record<GeoSaveState, string> = {
  saved: "Saved",
  saving: "Saving…",
  unsaved: "Unsaved changes",
  error: "Save failed",
};

/** Blank reports are not persisted, so opening the builder leaves no empty rows behind. */
function isBlank(report: GeoReport) {
  return (
    !report.company.name.trim() &&
    !report.company.domain.trim() &&
    report.prompts.length === 0 &&
    report.competitors.length === 0
  );
}

export function GeoReportEditor({
  slug,
  initialReport,
  reportId,
  shareToken,
}: GeoReportEditorProps) {
  const router = useRouter();
  const [report, setReport] = useState<GeoReport>(initialReport);
  const [sections, setSections] = useState<GeoReportSectionState>(
    GEO_DEFAULT_SECTION_STATE
  );
  const [saveState, setSaveState] = useState<GeoSaveState>(
    reportId ? "saved" : "unsaved"
  );
  const [progress, setProgress] = useState<GeoScanProgress | null>(null);
  const persisted = useRef<GeoSavedReport | null>(
    reportId && shareToken ? { id: reportId, shareToken } : null
  );
  const latest = useRef(report);
  const savedReport = useRef<GeoReport | null>(reportId ? initialReport : null);
  const inFlight = useRef<Promise<GeoSavedReport | null> | null>(null);
  const queued = useRef<Promise<GeoSavedReport | null> | null>(null);
  const pendingScanAt = useRef<string | null>(null);
  const saveTimer = useRef<number | null>(null);
  const scanController = useRef<AbortController | null>(null);
  const scanCells = useRef<GeoScanCell[]>([]);
  const siteText = useRef("");

  useLayoutEffect(() => {
    latest.current = report;
  }, [report]);

  /**
   * Saves the current state. Edits that land while a save is running are
   * coalesced into one follow-up save, and every caller awaits that final one.
   */
  const persist = useCallback(async (): Promise<GeoSavedReport | null> => {
    if (inFlight.current) {
      queued.current ??= inFlight.current.then(() => {
        queued.current = null;
        return persist();
      });
      return await queued.current;
    }
    if (savedReport.current === latest.current && !pendingScanAt.current) {
      return persisted.current;
    }
    const run = async () => {
      setSaveState("saving");
      const scannedAt = pendingScanAt.current;
      const submittedReport = latest.current;
      const result = await saveGeoReportAction({
        slug,
        id: persisted.current?.id ?? null,
        report: submittedReport,
        scannedAt,
      }).catch(() => ({
        data: null,
        error: { message: "Could not reach the report service" },
      }));
      if (result.error || !result.data) {
        setSaveState("error");
        toast.error(result.error?.message ?? "Could not save the report");
        return null;
      }
      const wasNew = persisted.current === null;
      persisted.current = result.data;
      savedReport.current = submittedReport;
      if (pendingScanAt.current === scannedAt) {
        pendingScanAt.current = null;
      }
      if (wasNew) {
        window.history.replaceState(
          null,
          "",
          `/${slug}/geo-reports/${result.data.id}`
        );
      }
      setSaveState(
        latest.current === submittedReport && !pendingScanAt.current
          ? "saved"
          : "unsaved"
      );
      return result.data;
    };
    inFlight.current = run().finally(() => {
      inFlight.current = null;
    });
    const result = await inFlight.current;
    if (
      result &&
      (savedReport.current !== latest.current || pendingScanAt.current)
    ) {
      return persist();
    }
    return result;
  }, [slug]);

  // Debounced autosave on every change after the initial render.
  useEffect(() => {
    if (report === initialReport) {
      return;
    }
    if (persisted.current === null && isBlank(report)) {
      return;
    }
    setSaveState("unsaved");
    saveTimer.current = window.setTimeout(() => {
      persist();
    }, GEO_AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }
    };
  }, [report, initialReport, persist]);

  useEffect(() => {
    const dirty = () =>
      savedReport.current !== latest.current &&
      (persisted.current !== null || !isBlank(latest.current));
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty()) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const navigate = (event: MouseEvent) => {
      if (
        !dirty() ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.target === "_blank" ||
        anchor.origin !== location.origin ||
        anchor.pathname === location.pathname
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      void persist().then((saved) => {
        if (saved) {
          router.push(anchor.pathname + anchor.search + anchor.hash);
        }
      });
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", navigate, true);
      scanController.current?.abort();
      if (dirty()) {
        void persist();
      }
    };
  }, [persist, router]);

  const update: GeoReportUpdater = useCallback((recipe) => {
    setReport((current) => recipe(current));
  }, []);

  const models = useMemo(
    () => GEO_MODELS.filter((model) => report.modelIds.includes(model.id)),
    [report.modelIds]
  );
  const options = useMemo(() => ({ sections, models }), [sections, models]);

  /** The link needs a saved row, so flush any pending edits first. */
  async function sharePath() {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
    }
    if (persisted.current === null && isBlank(latest.current)) {
      toast.error("Add a company before sharing");
      return null;
    }
    const saved = await persist();
    if (!saved) {
      return null;
    }
    return buildGeoSharePath(saved.shareToken, sections);
  }

  async function copyLink() {
    const path = await sharePath();
    if (!path) {
      return;
    }
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      toast.success("Link copied");
    } catch {
      toast.error(
        "Could not copy. Use Open link and copy the address instead."
      );
    }
  }

  async function openLink() {
    const path = await sharePath();
    if (path) {
      window.open(path, "_blank", "noopener");
    }
  }

  async function startScan() {
    if (report.modelIds.length === 0) {
      toast.error("Select at least one model");
      return;
    }
    if (!report.company.name.trim()) {
      toast.error("Add the company name first");
      return;
    }
    if (report.prompts.every((prompt) => !prompt.text.trim())) {
      toast.error("Add at least one prompt");
      return;
    }
    const controller = new AbortController();
    scanController.current = controller;
    scanCells.current = [];
    const snapshot = report;
    await runGeoScan({
      report: snapshot,
      siteText: siteText.current,
      signal: controller.signal,
      onProgress: setProgress,
      onError: (message) => toast.error(message),
      onCell: (cell) => {
        scanCells.current = [...scanCells.current, cell];
        setReport((current) => applyScanCell(current, cell));
      },
    });
    if (!controller.signal.aborted) {
      if (scanCells.current.length > 0) {
        let completed = applyScanSummary(
          scanCells.current.reduce(
            (current, cell) => applyScanCell(current, cell),
            latest.current
          ),
          scanCells.current
        );
        try {
          const response = await fetch("/api/geo/recommend", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              company: completed.company,
              gaps: completed.opportunities.map((gap) => ({
                id: gap.id,
                prompt: gap.prompt,
                gap: gap.gap,
                heldBy: gap.occupiedBy.map(
                  (id) =>
                    completed.competitors.find((item) => item.id === id)
                      ?.name ?? id
                ),
              })),
            }),
          });
          if (!response.ok) {
            throw new Error("Recommendations could not be generated");
          }
          const data = (await response.json()) as {
            items: GeoRecommendation[];
          };
          completed = applyRecommendations(completed, data.items);
        } catch {
          if (!controller.signal.aborted) {
            toast.error(
              "Scan saved without recommendations. Retry the scan to generate next steps."
            );
          }
        }
        if (!controller.signal.aborted) {
          pendingScanAt.current = new Date().toISOString();
          latest.current = completed;
          setReport(completed);
          await persist();
          toast.success(
            `Scan finished: ${scanCells.current.length} answers read`
          );
        }
      } else {
        toast.error("No scan answers succeeded");
      }
    }
    scanController.current = null;
    setProgress(null);
  }

  function stopScan() {
    scanController.current?.abort();
    scanController.current = null;
    if (scanCells.current.length > 0) {
      pendingScanAt.current = new Date().toISOString();
      setReport((current) => applyScanSummary(current, scanCells.current));
    }
    setProgress(null);
    toast.message("Scan stopped");
  }

  const scanning = progress !== null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-dashed px-4 py-2 lg:px-6">
        <Button
          nativeButton={false}
          render={<Link href={`/${slug}/geo-reports`} />}
          size="icon-sm"
          variant="ghost"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} />
          <span className="sr-only">Back to GEO reports</span>
        </Button>
        <span className="truncate text-sm font-medium">
          {report.company.name
            ? `${report.company.name} · GEO report`
            : "New GEO report"}
        </span>
        <span
          className="text-muted-foreground data-[state=error]:text-destructive text-xs"
          data-state={saveState}
        >
          {SAVE_STATE_LABELS[saveState]}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Select
            onValueChange={(next) => {
              const status = STATUSES.find((value) => value === next);
              if (status) {
                update((current) => ({ ...current, status }));
              }
            }}
            value={report.status}
          >
            <SelectTrigger className="w-28" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {GEO_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {scanning ? (
            <Button onClick={stopScan} size="sm" variant="destructive">
              <HugeiconsIcon icon={StopIcon} />
              Stop
            </Button>
          ) : (
            <Button onClick={startScan} size="sm" variant="outline">
              <HugeiconsIcon icon={PlayIcon} />
              Run scan
            </Button>
          )}
          <Button
            disabled={scanning}
            onClick={() => setReport(EXAMPLE_GEO_REPORT)}
            size="sm"
            variant="ghost"
          >
            Load example
          </Button>
          {persisted.current ? (
            <DeleteReportDialog
              companyName={report.company.name}
              onDeleted={() => {
                savedReport.current = latest.current;
                router.push(`/${slug}/geo-reports`);
              }}
              reportId={persisted.current.id}
              slug={slug}
            />
          ) : null}
          <Button onClick={openLink} size="sm" variant="outline">
            <HugeiconsIcon icon={LinkSquare02Icon} />
            Open link
          </Button>
          <Button onClick={copyLink} size="sm">
            <HugeiconsIcon icon={Link04Icon} />
            Copy link
          </Button>
        </div>
      </div>

      {progress ? (
        <div className="bg-muted/40 flex shrink-0 items-center gap-3 border-b border-dashed px-4 py-2 text-xs lg:px-6">
          <span className="bg-muted relative h-1.5 w-40 overflow-hidden rounded-full">
            <span
              className="bg-primary absolute inset-y-0 left-0 rounded-full transition-[width]"
              style={{
                width: `${progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * PERCENT)}%`,
              }}
            />
          </span>
          <span className="tabular-nums">
            {progress.done}/{progress.total}
            {progress.failed > 0 ? ` · ${progress.failed} failed` : ""}
          </span>
          <span className="text-muted-foreground truncate">
            {progress.current}
          </span>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <aside className="w-[30rem] shrink-0 overflow-y-auto border-r border-dashed px-4 pb-16">
          <fieldset disabled={scanning} className="min-w-0">
            <EditorSection
              defaultOpen={false}
              description="Hide parts you don't want in the shared report."
              title="Sections"
            >
              <ul className="grid gap-1">
                {GEO_REPORT_SECTIONS.map((section) => {
                  const inputId = `geo-editor-section-${section.id}`;
                  return (
                    <li
                      className="flex items-center gap-3 py-1"
                      key={section.id}
                    >
                      <Switch
                        checked={sections[section.id]}
                        id={inputId}
                        onCheckedChange={(checked) =>
                          setSections((current) => ({
                            ...current,
                            [section.id]: checked,
                          }))
                        }
                        size="sm"
                      />
                      <Label className="font-normal" htmlFor={inputId}>
                        {section.label}
                      </Label>
                    </li>
                  );
                })}
              </ul>
            </EditorSection>
            <CompanySection
              onLookup={(text) => {
                siteText.current = text;
              }}
              report={report}
              update={update}
            />
            <ModelsSection report={report} update={update} />
            <CompetitorsSection report={report} update={update} />
            <PromptsSection report={report} update={update} />
            <p className="text-muted-foreground pt-6 text-xs leading-relaxed">
              Everything else in the report is produced by the scan. Changes
              save to the workspace as you go; the share link always shows the
              latest saved version.
            </p>
          </fieldset>
        </aside>

        <div className="bg-muted/30 min-w-0 flex-1 overflow-y-auto p-6">
          <div
            className="mx-auto max-w-5xl overflow-hidden rounded-2xl shadow-lg ring-1 ring-black/10 dark:ring-white/10"
            style={{ zoom: PREVIEW_ZOOM }}
          >
            <GeoReportDocument options={options} report={report} />
          </div>
        </div>
      </div>
    </div>
  );
}
