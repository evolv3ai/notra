import type { AnySuite } from "../types/eval";
import { autopilotPlannerSuite } from "./autopilot-planner";
import { chatRouterSuite } from "./chat-router";
import { collectionTitleSuite } from "./collection-title";
import { contentAgentSuite, contentDraftSuite } from "./content-agent";
import { contentUnslopSuite } from "./content-unslop";
import { feedbackClassifierSuite } from "./feedback-classifier";

export const SUITES: readonly AnySuite[] = [
  contentDraftSuite,
  contentUnslopSuite,
  contentAgentSuite,
  collectionTitleSuite,
  chatRouterSuite,
  feedbackClassifierSuite,
  autopilotPlannerSuite,
];

export function getSuite(id: string): AnySuite | undefined {
  return SUITES.find((suite) => suite.id === id);
}
