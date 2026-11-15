import { Link01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Input } from "@notra/ui/components/ui/input";
import { Label } from "@notra/ui/components/ui/label";
import { Switch } from "@notra/ui/components/ui/switch";
import { debounce, useQueryStates } from "nuqs";

import {
  UTM_BUILDER_MARKDOWN_PATH,
  UTM_BUILDER_URL,
  UTM_BUILDER_URL_DEBOUNCE_MS,
  UTM_CHANNEL_PRESETS,
  UTM_FIELDS,
  UTM_MEDIUM_SUGGESTIONS,
  UTM_QUICK_FILL_PRESET_IDS,
  UTM_SOURCE_SUGGESTIONS,
} from "@/constants/utm-builder";
import {
  buildChannelLinks,
  buildUtmLink,
  presetOverrides,
  splitTaggedLink,
} from "@/lib/utm-builder/build";
import { serializeUtmBuilder, utmBuilderParsers } from "@/schemas/utm-builder";
import type { UtmChannelPreset, UtmFieldKey } from "@/types/utm-builder";

import { UtmChannelLinks } from "./utm-channel-links";
import { UtmFieldInput } from "./utm-field-input";
import { UtmResultCard } from "./utm-result-card";

const SUGGESTION_LISTS: Partial<Record<UtmFieldKey, readonly string[]>> = {
  source: UTM_SOURCE_SUGGESTIONS,
  medium: UTM_MEDIUM_SUGGESTIONS,
};

const QUICK_FILL_PRESETS = UTM_CHANNEL_PRESETS.filter((preset) =>
  UTM_QUICK_FILL_PRESET_IDS.includes(preset.id)
);

const labelClass =
  "font-sans text-sm/4.5 font-medium text-[#1E1E1E] dark:text-white";
const sectionLabelClass =
  "font-sans text-[0.8125rem]/5 font-medium text-[#1E1E1E99] dark:text-white/50";

export function UtmBuilderTool() {
  const [state, setState] = useQueryStates(utmBuilderParsers, {
    clearOnDefault: true,
    history: "replace",
    scroll: false,
    limitUrlUpdates: debounce(UTM_BUILDER_URL_DEBOUNCE_MS),
  });

  const result = buildUtmLink(state);
  const channelLinks = buildChannelLinks(state);
  const shareHref = serializeUtmBuilder(UTM_BUILDER_URL, state);
  const markdownHref = serializeUtmBuilder(UTM_BUILDER_MARKDOWN_PATH, state);

  const handleUrlChange = (value: string) => {
    const tagged = splitTaggedLink(value);
    setState(
      tagged
        ? {
            ...Object.fromEntries(UTM_FIELDS.map((field) => [field.key, ""])),
            url: tagged.url,
            ...tagged.values,
          }
        : { url: value }
    );
  };

  const quickFill = (preset: UtmChannelPreset) => {
    setState(presetOverrides(state, preset));
  };

  const toggleChannel = (id: string) => {
    setState({
      channels: state.channels.includes(id)
        ? state.channels.filter((channel) => channel !== id)
        : [...state.channels, id],
    });
  };

  const fieldInput = (key: UtmFieldKey) => {
    const field = UTM_FIELDS.find((candidate) => candidate.key === key);
    if (!field) {
      return null;
    }
    return (
      <UtmFieldInput
        field={field}
        key={key}
        listId={SUGGESTION_LISTS[key] ? `utm-${key}-suggestions` : undefined}
        onChange={(value) => setState({ [key]: value })}
        value={state[key]}
      />
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {Object.entries(SUGGESTION_LISTS).map(([key, values]) => (
        <datalist id={`utm-${key}-suggestions`} key={key}>
          {values?.map((value) => (
            <option key={value} value={value} />
          ))}
        </datalist>
      ))}

      <div className="flex flex-col gap-2">
        <Label className={labelClass} htmlFor="utm-url">
          Destination URL
        </Label>
        <div className="relative">
          <HugeiconsIcon
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#1E1E1E66] dark:text-white/40"
            icon={Link01Icon}
          />
          <Input
            autoComplete="off"
            className="h-11 rounded-xl border-[#E4E4E4] bg-transparent py-3 pr-3.5 pl-10 font-mono text-[0.9375rem]/5 shadow-none placeholder:font-sans placeholder:text-[#1E1E1E66] dark:border-white/12 dark:placeholder:text-white/40"
            id="utm-url"
            inputMode="url"
            onChange={(event) => handleUrlChange(event.target.value)}
            placeholder="example.com/pricing, or paste a link that already has UTMs"
            spellCheck={false}
            value={state.url}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={sectionLabelClass}>Quick fill</span>
        {QUICK_FILL_PRESETS.map((preset) => (
          <button
            className="hover:border-primary hover:text-primary inline-flex cursor-pointer items-center rounded-lg border border-[#1E1E1E14] bg-white px-2.5 py-1 font-sans text-[0.8125rem]/5 font-medium text-[#1E1E1E] transition-colors dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
            key={preset.id}
            onClick={() => quickFill(preset)}
            type="button"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {fieldInput("source")}
        {fieldInput("medium")}
        {fieldInput("campaign")}
        {fieldInput("id")}
        {fieldInput("term")}
        {fieldInput("content")}
      </div>

      <details className="group rounded-xl border border-[#1E1E1E14] px-4 py-3 dark:border-white/10">
        <summary className="cursor-pointer font-sans text-sm/5 font-medium text-[#1E1E1E] dark:text-white">
          GA4 extras: source platform, creative format, marketing tactic
        </summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {UTM_FIELDS.filter((field) => field.advanced).map((field) =>
            fieldInput(field.key)
          )}
        </div>
      </details>

      <div className="flex items-start gap-3">
        <Switch
          checked={state.clean}
          id="utm-clean"
          onCheckedChange={(checked) => setState({ clean: checked })}
        />
        <Label
          className="flex flex-col items-start gap-0.5 font-sans"
          htmlFor="utm-clean"
        >
          <span className="text-sm/4.5 font-medium text-[#1E1E1E] dark:text-white">
            Clean up values
          </span>
          <span className="text-[0.8125rem]/5 font-normal text-[#1E1E1E99] dark:text-white/50">
            Lowercase and dashes instead of spaces. Placeholders like
            {" {keyword} "}stay untouched.
          </span>
        </Label>
      </div>

      <UtmResultCard
        markdownHref={markdownHref}
        result={result}
        shareHref={shareHref}
      />

      <div className="flex flex-col gap-3 border-t border-[#1E1E1E0D] pt-6 dark:border-white/10">
        <div className="flex flex-col gap-1">
          <span className={labelClass}>Tag every channel at once</span>
          <span className="font-sans text-[0.8125rem]/5 text-[#1E1E1E99] dark:text-white/50">
            Pick where this campaign goes. Each link keeps your campaign, ID and
            extras and gets the right source and medium.
          </span>
        </div>
        <UtmChannelLinks
          links={channelLinks}
          onToggle={toggleChannel}
          selected={state.channels}
        />
      </div>
    </div>
  );
}
