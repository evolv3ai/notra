import type { CloudLedger, OwnedResource } from "../types/resources";
import { assertOwned } from "./ownership";

export function ownedBoxFetch(
  ledger: CloudLedger,
  persist: () => void,
  transport: typeof fetch
): typeof fetch {
  return (async (input, init) => {
    let request = new Request(input, init);
    let allocation: OwnedResource | undefined;
    if (
      request.url.startsWith("https://us-east-1.box.upstash.com/v2/box") &&
      request.method === "POST" &&
      (request.url.endsWith("/box") ||
        request.url.endsWith("/from-snapshot") ||
        request.url.endsWith("/snapshots"))
    ) {
      const body = await request.clone().json();
      if (request.url.endsWith("/snapshots")) {
        allocation = ledger.resources.find(
          (resource) =>
            resource.kind === "snapshot" && resource.name === body.name
        );
      } else {
        allocation = ledger.resources.find(
          (resource) => resource.kind === "box" && resource.name === body.name
        );
        if (
          !allocation &&
          body.name === `notra-site-${ledger.runId.slice(0, 16)}` &&
          ledger.resources.some(
            (resource) =>
              resource.kind === "snapshot" && resource.id === body.snapshot_id
          )
        ) {
          allocation = ledger.resources.find(
            (resource) =>
              resource.kind === "box" &&
              resource.name.startsWith(`${ledger.runId}-build-`) &&
              !resource.deleted &&
              !resource.id
          );
        }
        if (!allocation) {
          throw new Error("Unowned Box allocation refused");
        }
        body.name = allocation.name;
        body.ttl = 600;
        body.ephemeral = true;
        body.keep_alive = false;
        body.env_vars = {};
      }
      if (!allocation) {
        throw new Error("Unowned snapshot allocation refused");
      }
      assertOwned(ledger, allocation);
      request = new Request(request, {
        method: "POST",
        body: JSON.stringify(body),
      });
    }
    const response = await transport(request);
    if (allocation && response.ok) {
      const data = await response.clone().json();
      allocation.id = data.id;
      persist();
    }
    return response;
  }) as typeof fetch;
}
