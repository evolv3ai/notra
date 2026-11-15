import { Config, ConfigProvider, Effect, Layer } from "effect";

import { cloudflareQueuesLayer } from "../services/queue";
import { cloudflareTransportLayer } from "../services/transport";
import type { WorkerBindings } from "../types/worker";
import { configuredCryptoLayer } from "./crypto";
import { neonDatabaseLayer } from "./neon";

export const workerLayer = (bindings: WorkerBindings) =>
  Layer.mergeAll(
    Layer.unwrap(
      Effect.map(Config.Redacted("DATABASE_URL"), neonDatabaseLayer)
    ),
    configuredCryptoLayer,
    cloudflareQueuesLayer(bindings),
    cloudflareTransportLayer
  ).pipe(
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(bindings)))
  );
