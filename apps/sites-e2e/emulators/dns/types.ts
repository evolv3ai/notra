export type DnsRecordType = "A" | "CNAME" | "NS" | "TXT";

export interface DnsRecord {
  name: string;
  type: DnsRecordType;
  value: string;
  /** Who wrote it, for the report: "seed", "vercel", … */
  source: string;
}
