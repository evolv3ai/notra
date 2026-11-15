import {
  PERSONA_GENERATION_FAILED_MESSAGE,
  PERSONA_GENERATION_START_TIMEOUT_MS,
} from "@/constants/persona-generation";
import {
  claimPersonaGenerationJob,
  readPersonaGenerationJob,
  updatePersonaGenerationJob,
} from "@/lib/geo/persona-generation-store";
import type { PersonaGenerationJob } from "@/types/persona-generation";
import { personaGenerationWorkflow } from "@/workflows/persona-generation";

export async function getPersonaGeneration(
  organizationId: string,
  projectId: string
) {
  const job = await readPersonaGenerationJob(organizationId, projectId);
  if (!job || job.status === "completed" || job.status === "failed") {
    return job;
  }
  // The workflow runtime is ~2 MB; GEO pages load this module just to read
  // job state, so it is only imported once there is a run to inspect.
  const { runId } = job;
  const status = runId
    ? await import("workflow/api").then(({ getRun }) => getRun(runId).status)
    : null;
  const timedOut =
    (!job.runId || status === "pending") &&
    Date.now() - Date.parse(job.startedAt) >
      PERSONA_GENERATION_START_TIMEOUT_MS;
  const failed = status === "failed" || status === "cancelled" || timedOut;
  if (failed) {
    await updatePersonaGenerationJob(
      job,
      {
        status: "failed",
        error: PERSONA_GENERATION_FAILED_MESSAGE,
      },
      timedOut
    );
    return readPersonaGenerationJob(organizationId, projectId);
  }
  return job;
}

export async function startPersonaGeneration(
  organizationId: string,
  projectId: string,
  personaId?: string,
  brief?: string,
  promptsOnly?: boolean
) {
  await getPersonaGeneration(organizationId, projectId);
  const requested: PersonaGenerationJob = {
    id: crypto.randomUUID(),
    organizationId,
    projectId,
    personaId,
    brief,
    promptsOnly,
    status: "queued",
    startedAt: new Date().toISOString(),
    runId: null,
    error: null,
  };
  const job = await claimPersonaGenerationJob(requested);
  if (job.id !== requested.id) {
    return job;
  }
  const { start } = await import("workflow/api");
  const run = await start(personaGenerationWorkflow, [job]);
  await updatePersonaGenerationJob(job, { runId: run.runId });
  return { ...job, runId: run.runId };
}
