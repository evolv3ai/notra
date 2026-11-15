import {
  WorkflowShell,
  WorkflowShellCard,
  WorkflowShellHeader,
} from "../../workflow/components/workflow-shell";
import { OutreachSequence } from "../components/outreach-sequence";
import type { OutreachSequenceStep } from "../types/outreach";

const STEPS: OutreachSequenceStep[] = [
  {
    at: "Oct 20",
    day: 0,
    id: "s1",
    status: "opened",
    subject: "Notra for your changelog roundup",
  },
  {
    at: "Oct 23",
    day: 3,
    id: "s2",
    status: "replied",
    subject: "Re: Notra for your changelog roundup",
  },
  {
    at: "Oct 27",
    day: 7,
    id: "s3",
    status: "cancelled",
    subject: "Last note from me",
  },
];

export default function OutreachSequenceExample() {
  return (
    <WorkflowShell className="w-full max-w-sm">
      <WorkflowShellHeader>Sequence</WorkflowShellHeader>
      <WorkflowShellCard className="p-4">
        <OutreachSequence steps={STEPS} />
      </WorkflowShellCard>
    </WorkflowShell>
  );
}
