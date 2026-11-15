import { WORKFLOW_LOGOS } from "../components/workflow-logo";
import { WorkflowShell, WorkflowShellCard } from "../components/workflow-shell";

export default function WorkflowLogoExample() {
  return (
    <div className="grid w-full max-w-2xl grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
      {Object.entries(WORKFLOW_LOGOS).map(([key, { label, logo: Logo }]) => (
        <WorkflowShell key={key}>
          <WorkflowShellCard className="flex h-14 items-center justify-center">
            <Logo className="size-6" />
          </WorkflowShellCard>
          <span className="text-muted-foreground truncate px-2 py-1.5 text-center text-[0.6875rem]">
            {label}
          </span>
        </WorkflowShell>
      ))}
    </div>
  );
}
