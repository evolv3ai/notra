import { describe, expect, test } from "bun:test";

import { renderToStaticMarkup } from "react-dom/server";

import {
  AutopilotTemplatesPage,
  AutopilotTemplatesSection,
} from "../src/components/autopilot/autopilot-templates";
import { AUTOPILOT_TEMPLATES } from "../src/constants/autopilot-templates";
import type { AutopilotTemplateActions } from "../src/types/autopilot-templates";

const actions: AutopilotTemplateActions = {
  jobs: {},
  canManage: true,
  isAdding: false,
  onAddBuiltIn: () => undefined,
  onOpenBuiltIn: () => undefined,
};

describe("Autopilot templates", () => {
  test("shows the complete gallery without prototype controls or fake workspace data", () => {
    const html = renderToStaticMarkup(<AutopilotTemplatesPage {...actions} />);
    expect(html.match(/<article/g)).toHaveLength(3);
    expect(html).not.toContain("Not yet available");
    expect(html.match(/>Enable template<\/button>/g)).toHaveLength(3);
    expect(html).not.toContain("Dominik");
    expect(html).not.toContain("Keep pricing page in sync");
    expect(html).not.toContain("Create");
  });

  test("members can browse but cannot enable inactive templates", () => {
    const html = renderToStaticMarkup(
      <AutopilotTemplatesPage {...actions} canManage={false} />
    );
    expect(html.match(/<article/g)).toHaveLength(3);
    expect(html.match(/<button[^>]*disabled=""/g)).toHaveLength(3);
    expect(html).toContain("Ask a workspace admin to enable templates.");
  });

  test("active jobs stay openable for members while inactive jobs are blocked during a save", () => {
    const html = renderToStaticMarkup(
      <AutopilotTemplatesPage
        {...actions}
        canManage={false}
        isAdding
        jobs={{ readiness: true }}
      />
    );
    expect(html.match(/<button[^>]*disabled=""/g)).toHaveLength(2);
    expect(html).toContain("Open automation");
    expect(html).toContain("Active");
    const pending = renderToStaticMarkup(
      <AutopilotTemplatesPage {...actions} isAdding />
    );
    expect(pending.match(/<button[^>]*disabled=""/g)).toHaveLength(3);
  });

  test("featured templates are visible to members and available kinds match real jobs", () => {
    const html = renderToStaticMarkup(
      <AutopilotTemplatesSection
        {...actions}
        canManage={false}
        onMore={() => undefined}
      />
    );
    expect(html.match(/<article/g)).toHaveLength(3);
    expect(html).toContain("Browse templates");
    expect(AUTOPILOT_TEMPLATES.map((template) => template.kind)).toEqual([
      "readiness",
      "keywords",
      "commits",
    ]);
  });

  test("featured templates hide automations that are already on", () => {
    const html = renderToStaticMarkup(
      <AutopilotTemplatesSection
        {...actions}
        jobs={{ readiness: true }}
        onMore={() => undefined}
      />
    );
    expect(html.match(/<article/g)).toHaveLength(2);
    expect(html).not.toContain("Fix agent readiness");
    expect(html).not.toContain("Open automation");
  });

  test("the section disappears once every template is on", () => {
    const html = renderToStaticMarkup(
      <AutopilotTemplatesSection
        {...actions}
        jobs={{ readiness: true, keywords: true, commits: true }}
        onMore={() => undefined}
      />
    );
    expect(html).toBe("");
  });
});
