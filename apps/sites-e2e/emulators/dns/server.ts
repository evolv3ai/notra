import { createSocket } from "node:dgram";
import type { AddressInfo } from "node:net";

import type { EmulatedRequest } from "../core/types";
import type { DnsRecordType } from "./types";
import type { DnsZone } from "./zone";

const TYPES: Record<number, DnsRecordType> = {
  1: "A",
  2: "NS",
  5: "CNAME",
  16: "TXT",
};
const CODES = Object.fromEntries(
  Object.entries(TYPES).map(([code, type]) => [type, Number(code)])
) as Record<DnsRecordType, number>;

function readName(packet: Buffer, offset: number) {
  const labels: string[] = [];
  let position = offset;
  for (;;) {
    const length = packet[position] ?? 0;
    position += 1;
    if (length === 0) {
      break;
    }
    labels.push(packet.subarray(position, position + length).toString());
    position += length;
  }
  return { name: labels.join("."), end: position };
}

function encodeName(name: string) {
  return Buffer.concat([
    ...name
      .split(".")
      .filter(Boolean)
      .map((label) =>
        Buffer.concat([Buffer.from([label.length]), Buffer.from(label)])
      ),
    Buffer.from([0]),
  ]);
}

function rdata(type: DnsRecordType, value: string) {
  if (type === "A") {
    return Buffer.from(value.split(".").map(Number));
  }
  if (type === "TXT") {
    const chunks: Buffer[] = [];
    for (let index = 0; index < value.length || index === 0; index += 255) {
      const part = Buffer.from(value.slice(index, index + 255));
      chunks.push(Buffer.from([part.length]), part);
    }
    return Buffer.concat(chunks);
  }
  return encodeName(value);
}

// A UDP DNS server for A/CNAME/NS/TXT answering from the shared zone; the
// backend's resolvers reach it through SITES_DNS_SERVERS. Unknown names get
// NXDOMAIN, known names without that type an empty NOERROR answer.
export async function startDnsServer(zone: DnsZone) {
  const socket = createSocket("udp4");
  const requests: EmulatedRequest[] = [];
  socket.on("message", (packet, remote) => {
    const id = packet.readUInt16BE(0);
    const question = readName(packet, 12);
    const typeCode = packet.readUInt16BE(question.end);
    const type = TYPES[typeCode];
    const answers = type ? zone.lookup(question.name, type) : [];
    const rcode = answers.length === 0 && !zone.knows(question.name) ? 3 : 0;
    requests.push({
      service: "dns",
      method: type ?? `TYPE${typeCode}`,
      path: question.name,
      status: rcode === 3 ? 404 : 200,
      durationMs: 0,
      handled: Boolean(type),
    });
    const header = Buffer.alloc(12);
    header.writeUInt16BE(id, 0);
    header.writeUInt16BE(0x8180 | rcode, 2);
    header.writeUInt16BE(1, 4);
    header.writeUInt16BE(answers.length, 6);
    const body = answers.map((answer) => {
      const data = rdata(answer.type, answer.value);
      const fixed = Buffer.alloc(12);
      fixed.writeUInt16BE(0xc00c, 0);
      fixed.writeUInt16BE(CODES[answer.type], 2);
      fixed.writeUInt16BE(1, 4);
      fixed.writeUInt32BE(60, 6);
      fixed.writeUInt16BE(data.length, 10);
      return Buffer.concat([fixed, data]);
    });
    socket.send(
      Buffer.concat([header, packet.subarray(12, question.end + 4), ...body]),
      remote.port,
      remote.address
    );
  });
  await new Promise<void>((resolveBind) =>
    socket.bind(0, "127.0.0.1", () => resolveBind())
  );
  const { port } = socket.address() as AddressInfo;
  return {
    name: "dns",
    url: `127.0.0.1:${port}`,
    requests,
    env: { SITES_DNS_SERVERS: `127.0.0.1:${port}` },
    close: () =>
      new Promise<void>((resolveClose) => socket.close(() => resolveClose())),
  };
}
