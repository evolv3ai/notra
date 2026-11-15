import { OutreachStats } from "../components/outreach-stats";
import { OUTREACH_STATS } from "../constants/outreach";

export default function OutreachStatsExample() {
  return <OutreachStats className="w-full" stats={OUTREACH_STATS} />;
}
