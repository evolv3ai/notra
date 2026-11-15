"use client";

import { PlusSignIcon, SparklesIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@notra/ui/components/ui/button";
import { Input } from "@notra/ui/components/ui/input";
import { Switch } from "@notra/ui/components/ui/switch";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { BrandLogo } from "@/components/geo-reports/brand-logo";
import {
  GEO_INTENT_LABELS,
  GEO_MODELS,
  GEO_PROMPT_COUNT,
} from "@/constants/geo-report";
import {
  createCompetitor,
  createPrompt,
  nameFromDomain,
  normalizeDomain,
  syncModels,
  resetScanState,
} from "@/lib/geo-reports/draft";
import type {
  GeoCompanyLookup,
  GeoEditorSectionProps,
  GeoGeneratedPrompt,
} from "@/types/geo-report";

import { EditorSection, Field, ListRow } from "./editor-primitives";

const LOGO_SIZE = 24;
const MIN_DOMAIN_LENGTH = 3;

function generateLabel(loading: boolean, hasPrompts: boolean) {
  if (loading) {
    return "Generating…";
  }
  return hasPrompts ? "Regenerate" : "Generate prompts";
}

interface CompanySectionProps extends GeoEditorSectionProps {
  onLookup: (siteText: string) => void;
}

/** Domain in, everything else about the company out. */
export function CompanySection({
  report,
  update,
  onLookup,
}: CompanySectionProps) {
  const [loading, setLoading] = useState(false);
  const domainId = useId();
  const lookedUp = useRef<string | null>(null);
  const domainRef = useRef(report.company.domain);
  const generation = useRef(0);
  useLayoutEffect(() => {
    domainRef.current = report.company.domain;
  }, [report.company.domain]);

  async function lookup() {
    const domain = report.company.domain.trim().toLowerCase();
    if (domain.length < MIN_DOMAIN_LENGTH || domain === lookedUp.current) {
      return;
    }
    setLoading(true);
    const requestId = ++generation.current;
    try {
      const response = await fetch(
        `/api/geo/company?domain=${encodeURIComponent(domain)}`
      );
      if (!response.ok) {
        throw new Error("Lookup failed");
      }
      const data = (await response.json()) as
        | GeoCompanyLookup
        | { error: string };
      if (!response.ok || "error" in data) {
        toast.error("error" in data ? data.error : "Lookup failed");
        return;
      }
      if (
        requestId !== generation.current ||
        normalizeDomain(domainRef.current) !== normalizeDomain(domain)
      ) {
        return;
      }
      lookedUp.current = domain;
      onLookup(data.siteText);
      update((current) => ({
        ...current,
        company: {
          ...current.company,
          name: data.name,
          category: data.category,
        },
        competitors: data.competitors.map((suggestion) =>
          createCompetitor({
            name: suggestion.name,
            domain: suggestion.domain,
            winsOn: suggestion.description,
          })
        ),
      }));
      toast.success(
        `${data.name}: ${data.competitors.length} competitors found`
      );
    } catch {
      toast.error("Could not reach the company lookup");
    } finally {
      if (requestId === generation.current) {
        setLoading(false);
      }
    }
  }

  return (
    <EditorSection
      description="Enter the domain. Name, category and competitors come from context.dev."
      title="Company"
    >
      <Field label="Domain" htmlFor={domainId}>
        <div className="flex items-center gap-2">
          {report.company.domain ? (
            <BrandLogo
              domain={report.company.domain}
              name={report.company.name || report.company.domain}
              size={LOGO_SIZE}
            />
          ) : null}
          <Input
            id={domainId}
            onBlur={lookup}
            onChange={(event) => {
              const domain = event.target.value;
              domainRef.current = domain;
              generation.current++;
              setLoading(false);
              onLookup("");
              update((current) => ({
                ...resetScanState(current),
                company: { name: "", category: "", domain },
              }));
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                lookup();
              }
            }}
            placeholder="resend.com"
            value={report.company.domain}
          />
          <Button
            disabled={loading}
            onClick={lookup}
            size="sm"
            variant="outline"
          >
            {loading ? "Looking up…" : "Look up"}
          </Button>
        </div>
      </Field>
      {report.company.name ? (
        <p className="text-sm">
          <span className="font-medium">{report.company.name}</span>
          {report.company.category ? (
            <span className="text-muted-foreground">
              {" "}
              · {report.company.category}
            </span>
          ) : null}
        </p>
      ) : null}
    </EditorSection>
  );
}

export function ModelsSection({ report, update }: GeoEditorSectionProps) {
  return (
    <EditorSection description="Which assistants to ask." title="Models">
      <ul className="grid gap-1">
        {GEO_MODELS.map((model) => {
          const inputId = `geo-editor-model-${model.id}`;
          const checked = report.modelIds.includes(model.id);
          return (
            <li className="flex items-center gap-3 py-1" key={model.id}>
              <Switch
                checked={checked}
                id={inputId}
                onCheckedChange={(next) =>
                  update((current) =>
                    syncModels(
                      current,
                      next
                        ? GEO_MODELS.map((item) => item.id).filter(
                            (id) =>
                              id === model.id || current.modelIds.includes(id)
                          )
                        : current.modelIds.filter((id) => id !== model.id)
                    )
                  )
                }
                size="sm"
              />
              <label
                className="flex items-center gap-2 text-sm"
                htmlFor={inputId}
              >
                <BrandLogo
                  domain={model.providerDomain}
                  name={model.provider}
                  size={LOGO_SIZE - 4}
                />
                {model.name}
                <span className="text-muted-foreground text-xs">
                  {model.surface}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </EditorSection>
  );
}

export function CompetitorsSection({ report, update }: GeoEditorSectionProps) {
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const attempted = useRef<Set<string>>(new Set());

  const setCompetitor = useCallback(
    (id: string, patch: Partial<(typeof report.competitors)[number]>) =>
      update((current) => ({
        ...current,
        competitors: current.competitors.map((item) =>
          item.id === id ? { ...item, ...patch } : item
        ),
      })),
    [update]
  );

  const resolve = useCallback(
    async (id: string, raw: string) => {
      const domain = normalizeDomain(raw);
      if (domain.length < MIN_DOMAIN_LENGTH) {
        return;
      }
      setCompetitor(id, { domain, name: nameFromDomain(domain) });
      setLoadingId(id);
      try {
        const response = await fetch(
          `/api/geo/company?domain=${encodeURIComponent(domain)}`
        );
        const data = (await response.json()) as
          | GeoCompanyLookup
          | { error: string };
        if (response.ok && !("error" in data)) {
          setCompetitor(id, {
            domain,
            name: data.name || nameFromDomain(domain),
            winsOn: data.summary || data.category,
          });
        }
      } catch {
        // Keep the prettified name; the logo still resolves from the domain.
      } finally {
        setLoadingId(null);
        setPendingIds((current) => current.filter((item) => item !== id));
      }
    },
    [setCompetitor]
  );

  // Rows with a domain but no description (e.g. restored drafts) get looked up once.
  useEffect(() => {
    for (const competitor of report.competitors) {
      if (
        competitor.winsOn ||
        !competitor.domain ||
        pendingIds.includes(competitor.id) ||
        attempted.current.has(competitor.id)
      ) {
        continue;
      }
      attempted.current.add(competitor.id);
      resolve(competitor.id, competitor.domain);
    }
  }, [report.competitors, pendingIds, resolve]);

  return (
    <EditorSection
      description="Found from the domain. Remove any that don't belong; numbers come from the scan."
      title="Competitors"
    >
      {report.competitors.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Look up a domain first, or add competitors by domain.
        </p>
      ) : null}
      {report.competitors.map((competitor) => (
        <ListRow
          key={competitor.id}
          onRemove={() =>
            update((current) => ({
              ...current,
              competitors: current.competitors.filter(
                (item) => item.id !== competitor.id
              ),
              opportunities: current.opportunities.map((opportunity) => ({
                ...opportunity,
                occupiedBy: opportunity.occupiedBy.filter(
                  (id) => id !== competitor.id
                ),
              })),
            }))
          }
          removeLabel={`Remove ${competitor.name || "competitor"}`}
        >
          {pendingIds.includes(competitor.id) ? (
            <Field
              label="Competitor domain"
              htmlFor={`competitor-domain-${competitor.id}`}
            >
              <Input
                id={`competitor-domain-${competitor.id}`}
                autoFocus
                disabled={loadingId === competitor.id}
                onBlur={(event) => resolve(competitor.id, event.target.value)}
                onChange={(event) =>
                  setCompetitor(competitor.id, { domain: event.target.value })
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    resolve(competitor.id, event.currentTarget.value);
                  }
                }}
                placeholder="postmarkapp.com"
                value={competitor.domain}
              />
            </Field>
          ) : (
            <div className="flex min-w-0 items-start gap-3">
              <BrandLogo
                className="mt-0.5"
                domain={competitor.domain}
                name={competitor.name}
                size={LOGO_SIZE}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {competitor.name}
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    · {competitor.domain}
                  </span>
                </span>
                {competitor.winsOn ? (
                  <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">
                    {competitor.winsOn}
                  </span>
                ) : null}
              </span>
            </div>
          )}
        </ListRow>
      ))}
      <Button
        className="justify-self-start"
        onClick={() => {
          const competitor = createCompetitor();
          setPendingIds((current) => [...current, competitor.id]);
          update((current) => ({
            ...current,
            competitors: [...current.competitors, competitor],
          }));
        }}
        size="sm"
        variant="ghost"
      >
        <HugeiconsIcon icon={PlusSignIcon} />
        Add one by domain
      </Button>
    </EditorSection>
  );
}

export function PromptsSection({ report, update }: GeoEditorSectionProps) {
  const [loading, setLoading] = useState(false);

  async function generate() {
    if (!report.company.name.trim()) {
      toast.error("Look up the company first");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/geo/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: report.company,
          competitors: report.competitors.map((competitor) => competitor.name),
          count: GEO_PROMPT_COUNT,
        }),
      });
      if (!response.ok) {
        throw new Error("Could not generate prompts");
      }
      const data = (await response.json()) as
        | { prompts: GeoGeneratedPrompt[] }
        | { error: string };
      if (!response.ok || "error" in data) {
        toast.error(
          "error" in data ? data.error : "Could not generate prompts"
        );
        return;
      }
      update((current) => ({
        ...current,
        prompts: data.prompts.map((prompt) =>
          createPrompt(current.modelIds, prompt)
        ),
      }));
      toast.success(`${data.prompts.length} prompts generated`);
    } catch {
      toast.error("Could not reach the prompt generator");
    } finally {
      setLoading(false);
    }
  }

  return (
    <EditorSection
      description="The buying questions to ask every model. Generated from the company and its competitors; edit freely."
      title="Prompts"
    >
      <div className="flex gap-2">
        <Button
          disabled={loading}
          onClick={generate}
          size="sm"
          variant="outline"
        >
          <HugeiconsIcon icon={SparklesIcon} />
          {generateLabel(loading, report.prompts.length > 0)}
        </Button>
        <Button
          onClick={() =>
            update((current) => ({
              ...current,
              prompts: [...current.prompts, createPrompt(current.modelIds)],
            }))
          }
          size="sm"
          variant="ghost"
        >
          <HugeiconsIcon icon={PlusSignIcon} />
          Add
        </Button>
      </div>
      {report.prompts.map((prompt) => (
        <ListRow
          key={prompt.id}
          onRemove={() =>
            update((current) => ({
              ...current,
              prompts: current.prompts.filter((item) => item.id !== prompt.id),
            }))
          }
          removeLabel="Remove prompt"
        >
          <Input
            aria-label="Prompt"
            onChange={(event) =>
              update((current) => ({
                ...current,
                prompts: current.prompts.map((item) =>
                  item.id === prompt.id
                    ? { ...item, text: event.target.value }
                    : item
                ),
              }))
            }
            placeholder="Best transactional email API for developers"
            value={prompt.text}
          />
          <span className="text-muted-foreground text-xs">
            {GEO_INTENT_LABELS[prompt.intent]}
          </span>
        </ListRow>
      ))}
    </EditorSection>
  );
}
