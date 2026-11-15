import { createHash } from "node:crypto";

import { EmulatorError, startEmulator } from "../core/service";
import type { R2EmulatorOptions, StoredObject } from "./types";

const xml = (body: string, status = 200) =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${body}`, {
    status,
    headers: { "content-type": "application/xml" },
  });
const escape = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const s3Error = (status: number, code: string, message: string) =>
  xml(
    `<Error><Code>${code}</Code><Message>${escape(message)}</Message></Error>`,
    status
  );

// The SDK streams bodies with `aws-chunked` framing when it adds trailing
// checksums: `<hex size>[;chunk-signature=…]\r\n<data>\r\n` … `0\r\n<trailers>`.
function decodeBody(request: Request, raw: Uint8Array) {
  const sha = request.headers.get("x-amz-content-sha256") ?? "";
  const encoding = request.headers.get("content-encoding") ?? "";
  if (!(sha.startsWith("STREAMING-") || encoding.includes("aws-chunked"))) {
    return raw;
  }
  const parts: Uint8Array[] = [];
  let offset = 0;
  const text = new TextDecoder("latin1");
  for (;;) {
    const lineEnd = raw.indexOf(0x0a, offset);
    if (lineEnd < 0) {
      throw new EmulatorError(400, "Malformed aws-chunked body");
    }
    const header = text.decode(raw.subarray(offset, lineEnd)).trim();
    const size = Number.parseInt(header.split(";")[0] ?? "", 16);
    if (!Number.isFinite(size)) {
      throw new EmulatorError(400, "Malformed aws-chunked size");
    }
    if (size === 0) {
      break;
    }
    parts.push(raw.subarray(lineEnd + 1, lineEnd + 1 + size));
    offset = lineEnd + 1 + size + 2;
  }
  return Buffer.concat(parts);
}

// R2 through its S3 API (path style), with the semantics the Sites backend
// relies on: conditional writes (If-Match / If-None-Match: *) answer 412,
// ListObjectsV2 pages with continuation tokens and common prefixes, and
// DeleteObjects. `pageSize` below R2's 1000 makes the client walk pages.
// `binding()` reads the same objects the way the Worker's R2 binding does.
export async function startR2Emulator(options: R2EmulatorOptions) {
  const objects = new Map<string, StoredObject>();
  const store = (
    key: string,
    body: Uint8Array,
    metadata: Pick<StoredObject, "contentType" | "cacheControl">
  ) => {
    const etag = createHash("md5").update(body).digest("hex");
    objects.set(key, {
      body: new Uint8Array(body),
      etag,
      contentType: metadata.contentType,
      cacheControl: metadata.cacheControl,
      lastModified: new Date(),
    });
    return etag;
  };
  // Fault injection: another writer lands on `key` just before the next
  // conditional write to it (a second Worker or deploy racing this one).
  const concurrentWriters: {
    matches: (key: string, incoming: string) => boolean;
    write: (current: string) => string;
  }[] = [];
  const pageSize = options.pageSize ?? 1000;
  const keyOf = (bucket: string, key: string) => {
    if (bucket !== options.bucket) {
      throw new EmulatorError(404, `NoSuchBucket: ${bucket}`);
    }
    return key;
  };
  const authorize = (request: Request) => {
    const credential = request.headers
      .get("authorization")
      ?.match(/^AWS4-HMAC-SHA256 Credential=([^/]+)\//)?.[1];
    if (credential !== options.accessKeyId) {
      throw new EmulatorError(403, "InvalidAccessKeyId");
    }
  };
  const objectHeaders = (object: StoredObject) => ({
    etag: `"${object.etag}"`,
    "content-length": String(object.body.byteLength),
    "last-modified": object.lastModified.toUTCString(),
    ...(object.contentType ? { "content-type": object.contentType } : {}),
    ...(object.cacheControl ? { "cache-control": object.cacheControl } : {}),
  });
  const server = await startEmulator("r2", [
    {
      method: "PUT",
      path: "/:bucket/:key+",
      handle: async (request, params) => {
        authorize(request);
        const key = keyOf(params.bucket ?? "", params.key ?? "");
        const ifNoneMatch = request.headers.get("if-none-match");
        const ifMatch = request.headers.get("if-match")?.replaceAll('"', "");
        const body = decodeBody(
          request,
          new Uint8Array(await request.arrayBuffer())
        );
        const incoming = new TextDecoder().decode(body);
        const racing = concurrentWriters.findIndex((writer) =>
          writer.matches(key, incoming)
        );
        const raced = objects.get(key);
        if (racing >= 0 && raced && (ifMatch !== undefined || ifNoneMatch)) {
          const [writer] = concurrentWriters.splice(racing, 1);
          store(
            key,
            new TextEncoder().encode(
              writer?.write(new TextDecoder().decode(raced.body)) ?? ""
            ),
            raced
          );
        }
        const current = objects.get(key);
        if (
          (ifNoneMatch === "*" && current) ||
          (ifMatch !== undefined && ifMatch !== current?.etag)
        ) {
          return s3Error(
            412,
            "PreconditionFailed",
            `Precondition failed for ${key}`
          );
        }
        const etag = store(key, body, {
          contentType: request.headers.get("content-type"),
          cacheControl: request.headers.get("cache-control"),
        });
        return new Response(null, { headers: { etag: `"${etag}"` } });
      },
    },
    {
      method: "GET",
      path: "/:bucket/:key+",
      handle: (request, params) => {
        authorize(request);
        const object = objects.get(
          keyOf(params.bucket ?? "", params.key ?? "")
        );
        if (!object) {
          return s3Error(404, "NoSuchKey", "The specified key does not exist.");
        }
        return new Response(object.body, { headers: objectHeaders(object) });
      },
    },
    {
      method: "HEAD",
      path: "/:bucket/:key+",
      handle: (request, params) => {
        authorize(request);
        const object = objects.get(
          keyOf(params.bucket ?? "", params.key ?? "")
        );
        return object
          ? new Response(null, { headers: objectHeaders(object) })
          : new Response(null, { status: 404 });
      },
    },
    {
      method: "DELETE",
      path: "/:bucket/:key+",
      handle: (request, params) => {
        authorize(request);
        objects.delete(keyOf(params.bucket ?? "", params.key ?? ""));
        return new Response(null, { status: 204 });
      },
    },
    {
      method: "GET",
      path: "/:bucket",
      handle: (request, params, url) => {
        authorize(request);
        keyOf(params.bucket ?? "", "");
        if (url.searchParams.get("list-type") !== "2") {
          return s3Error(
            501,
            "NotImplemented",
            "Only ListObjectsV2 is emulated"
          );
        }
        const prefix = url.searchParams.get("prefix") ?? "";
        const delimiter = url.searchParams.get("delimiter") ?? "";
        const token = url.searchParams.get("continuation-token");
        const after = token ? Buffer.from(token, "base64url").toString() : "";
        const limit = Math.min(
          pageSize,
          Number(url.searchParams.get("max-keys") ?? 1000)
        );
        const entries: { key?: string; prefix?: string }[] = [];
        const seen = new Set<string>();
        for (const key of [...objects.keys()].sort()) {
          if (!key.startsWith(prefix) || key <= after) {
            continue;
          }
          const rest = key.slice(prefix.length);
          const cut = delimiter ? rest.indexOf(delimiter) : -1;
          if (cut >= 0) {
            const common = prefix + rest.slice(0, cut + delimiter.length);
            if (!seen.has(common)) {
              seen.add(common);
              entries.push({ prefix: common, key });
            }
            continue;
          }
          entries.push({ key });
        }
        const page = entries.slice(0, limit);
        const truncated = entries.length > limit;
        const last = page.at(-1);
        // A common prefix is resumed after its whole subtree.
        const resume = last?.prefix ? `${last.prefix}￿` : last?.key;
        return xml(
          [
            '<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">',
            `<Name>${escape(options.bucket)}</Name>`,
            `<Prefix>${escape(prefix)}</Prefix>`,
            `<KeyCount>${page.length}</KeyCount>`,
            `<MaxKeys>${limit}</MaxKeys>`,
            `<IsTruncated>${truncated}</IsTruncated>`,
            ...(token
              ? [`<ContinuationToken>${escape(token)}</ContinuationToken>`]
              : []),
            ...(truncated && resume
              ? [
                  `<NextContinuationToken>${Buffer.from(resume).toString("base64url")}</NextContinuationToken>`,
                ]
              : []),
            ...page.flatMap((entry) => {
              if (entry.prefix) {
                return [
                  `<CommonPrefixes><Prefix>${escape(entry.prefix)}</Prefix></CommonPrefixes>`,
                ];
              }
              const object = objects.get(entry.key ?? "");
              return object
                ? [
                    `<Contents><Key>${escape(entry.key ?? "")}</Key><LastModified>${object.lastModified.toISOString()}</LastModified><ETag>"${object.etag}"</ETag><Size>${object.body.byteLength}</Size><StorageClass>STANDARD</StorageClass></Contents>`,
                  ]
                : [];
            }),
            "</ListBucketResult>",
          ].join("")
        );
      },
    },
    {
      method: "POST",
      path: "/:bucket",
      handle: async (request, params, url) => {
        authorize(request);
        keyOf(params.bucket ?? "", "");
        if (!url.searchParams.has("delete")) {
          return s3Error(
            501,
            "NotImplemented",
            "Only DeleteObjects is emulated"
          );
        }
        const body = new TextDecoder().decode(
          decodeBody(request, new Uint8Array(await request.arrayBuffer()))
        );
        const keys = [...body.matchAll(/<Key>([^<]*)<\/Key>/g)].map((match) =>
          (match[1] ?? "")
            .replaceAll("&lt;", "<")
            .replaceAll("&gt;", ">")
            .replaceAll("&quot;", '"')
            .replaceAll("&amp;", "&")
        );
        for (const key of keys) {
          objects.delete(key);
        }
        const quiet = /<Quiet>true<\/Quiet>/.test(body);
        return xml(
          `<DeleteResult>${quiet ? "" : keys.map((key) => `<Deleted><Key>${escape(key)}</Key></Deleted>`).join("")}</DeleteResult>`
        );
      },
    },
  ]);
  return {
    ...server,
    objects,
    env: {
      SITES_R2_ENDPOINT: server.url,
      SITES_R2_ACCOUNT_ID: "emulated-account",
      SITES_R2_ACCESS_KEY_ID: options.accessKeyId,
      SITES_R2_SECRET_ACCESS_KEY: "emulated-secret",
      SITES_R2_BUCKET: options.bucket,
    },
    /** The Worker's R2 binding view of the same bucket. */
    binding: () => ({
      get: async (key: string) => {
        const object = objects.get(key);
        server.requests.push({
          service: "r2",
          method: "GET",
          path: "binding get",
          status: object ? 200 : 404,
          durationMs: 0,
          handled: true,
        });
        return object
          ? {
              body: new Response(object.body).body,
              text: async () => new TextDecoder().decode(object.body),
            }
          : null;
      },
    }),
    has: (key: string) => objects.has(key),
    /**
     * Before the next matching conditional write (key and incoming body)
     * lands, another
     * writer replaces the object with `write(current)`. A client that honours
     * If-Match gets 412 and must retry on the new state.
     */
    raceNextConditionalWrite: (
      matches: (key: string, incoming: string) => boolean,
      write: (current: string) => string
    ) => {
      concurrentWriters.push({ matches, write });
    },
    pendingRaces: () => concurrentWriters.length,
    text: (key: string) => {
      const object = objects.get(key);
      return object ? new TextDecoder().decode(object.body) : null;
    },
  };
}
