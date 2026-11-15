"use client";

import {
  GEO_CLOUDFLARE_LOGPUSH_FIELDS,
  GEO_DRAIN_DOCS_URLS,
} from "@notra/geo-core/constants/geo";
import { useTranslations } from "use-intl";

import { ApiKeyRevealField } from "@/components/api-keys/api-key-reveal-field";
import { CodeSnippet } from "@/components/geo/code-snippet";
import type { GeoIngestDrainSetupProps } from "@/types/geo";
import {
  geoCloudflareDestination,
  geoCloudflareLogpushCommand,
  geoVercelDrainHeader,
} from "@/utils/geo-ingest";

export function GeoIngestDrainSetup({
  provider,
  setup,
  onCopy,
}: GeoIngestDrainSetupProps) {
  const t = useTranslations("geo.geoIngestSetup.drains");
  const token = setup?.token ?? "";
  const steps = [
    t(`${provider}.stepOne`),
    t(`${provider}.stepTwo`),
    t(`${provider}.stepThree`),
  ];

  return (
    <div className="space-y-5">
      <p className="text-muted-foreground text-xs leading-relaxed">
        {t(`${provider}.requirements`)}
      </p>
      {provider === "vercel" ? (
        <>
          <section className="space-y-2">
            <h3 className="text-sm font-medium">{t("vercel.endpointTitle")}</h3>
            <CodeSnippet
              code={setup?.drainUrls?.vercel ?? ""}
              onCopy={onCopy}
              variant="command"
            />
          </section>
          {token ? (
            <section className="space-y-2">
              <h3 className="text-sm font-medium">{t("vercel.headerTitle")}</h3>
              <p className="text-muted-foreground text-xs">
                {t("vercel.headerDescription")}
              </p>
              <ApiKeyRevealField value={geoVercelDrainHeader(token)} />
            </section>
          ) : null}
        </>
      ) : (
        <>
          {token ? (
            <section className="space-y-2">
              <h3 className="text-sm font-medium">
                {t("cloudflare.destinationTitle")}
              </h3>
              <p className="text-muted-foreground text-xs">
                {t("cloudflare.destinationDescription")}
              </p>
              <ApiKeyRevealField
                value={geoCloudflareDestination(setup, token)}
              />
            </section>
          ) : null}
          <section className="space-y-2">
            <h3 className="text-sm font-medium">
              {t("cloudflare.fieldsTitle")}
            </h3>
            <CodeSnippet
              code={GEO_CLOUDFLARE_LOGPUSH_FIELDS.join(", ")}
              onCopy={onCopy}
              variant="command"
            />
          </section>
        </>
      )}
      <section className="space-y-2">
        <h3 className="text-sm font-medium">{t("stepsTitle")}</h3>
        <ol className="text-muted-foreground list-decimal space-y-1.5 pl-4 text-xs leading-relaxed">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
      {provider === "cloudflare" ? (
        <section className="space-y-2">
          <h3 className="text-sm font-medium">{t("cloudflare.apiTitle")}</h3>
          <CodeSnippet
            code={geoCloudflareLogpushCommand(setup)}
            filename={t("cloudflare.apiFilename")}
            onCopy={onCopy}
          />
        </section>
      ) : null}
      <p className="text-muted-foreground border-border/80 rounded-lg border px-3 py-2.5 text-xs leading-relaxed">
        {t(`${provider}.limitation`)}{" "}
        <a
          className="text-foreground underline underline-offset-2"
          href={GEO_DRAIN_DOCS_URLS[provider]}
          rel="noopener"
          target="_blank"
        >
          {t("docsLink")}
        </a>
      </p>
    </div>
  );
}
