import {
  OutreachCitations,
  OutreachStatusBadge,
} from "../../../registry/notra/outreach/components/outreach-status";
import { OUTREACH_PROSPECTS } from "../../../registry/notra/outreach/constants/outreach";

export default function ListicleOutreachPreview() {
  return (
    <div className="bg-card ring-foreground/10 divide-foreground/10 flex w-80 flex-col divide-y rounded-xl ring-1">
      {OUTREACH_PROSPECTS.slice(0, 3).map((prospect) => (
        <div className="flex items-center gap-3 px-3 py-2" key={prospect.id}>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-xs font-medium">
              {prospect.title}
            </span>
            <OutreachCitations citations={prospect.citations} />
          </span>
          <OutreachStatusBadge status={prospect.status} />
        </div>
      ))}
    </div>
  );
}
