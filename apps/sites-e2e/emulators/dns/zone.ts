import type { DnsRecord, DnsRecordType } from "./types";

const normalize = (name: string) => name.toLowerCase().replace(/\.$/, "");

// The DNS state every emulator shares: the Vercel DNS API writes records
// here, the DNS server answers from it and Cloudflare activates a custom
// hostname once its CNAME and ownership TXT exist.
export class DnsZone {
  readonly records: DnsRecord[] = [];

  add(record: DnsRecord) {
    const name = normalize(record.name);
    const exists = this.records.some(
      (entry) =>
        entry.name === name &&
        entry.type === record.type &&
        entry.value === record.value
    );
    if (!exists) {
      this.records.push({ ...record, name });
    }
    return !exists;
  }

  /** Removes matching records, as a user deleting them at their DNS host. */
  remove(name: string, type: DnsRecordType, value?: string) {
    const host = normalize(name);
    for (let index = this.records.length - 1; index >= 0; index -= 1) {
      const record = this.records[index];
      if (
        record?.name === host &&
        record.type === type &&
        (value === undefined || record.value === value)
      ) {
        this.records.splice(index, 1);
      }
    }
  }

  lookup(name: string, type: DnsRecordType) {
    const host = normalize(name);
    return this.records.filter(
      (record) => record.name === host && record.type === type
    );
  }

  has(name: string, type: DnsRecordType, value?: string) {
    return this.lookup(name, type).some(
      (record) =>
        value === undefined || normalize(record.value) === normalize(value)
    );
  }

  knows(name: string) {
    const host = normalize(name);
    return this.records.some((record) => record.name === host);
  }
}
