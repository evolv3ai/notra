import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { cpus } from "node:os";
import { performance } from "node:perf_hooks";
import {
  brotliCompressSync,
  brotliDecompressSync,
  constants,
  gunzipSync,
  gzipSync,
} from "node:zlib";

const root = new URL("../../", import.meta.url);
const publicDir = new URL("apps/web/.output/public/assets/", root);
const files = await readdir(publicDir);
const samples = [];
for (const extension of [".js", ".css"]) {
  const candidates = await Promise.all(
    files
      .filter((file) => file.endsWith(extension))
      .map(async (file) => ({
        file,
        bytes: (await stat(new URL(file, publicDir))).size,
      }))
  );
  candidates.sort((a, b) => b.bytes - a.bytes);
  if (!candidates[0]) {
    throw new Error(`Build website first: missing ${extension}`);
  }
  samples.push({
    name: candidates[0].file,
    data: await readFile(new URL(candidates[0].file, publicDir)),
  });
}
samples.push({
  name: "public-report-json",
  data: await readFile(
    new URL(
      "apps/web/src/content/state-of-ai-search/postgres/2026-10.json",
      root
    )
  ),
});
samples.push({
  name: "logo.svg",
  data: await readFile(new URL("apps/web/public/logo.svg", root)),
});
if (process.argv[2]) {
  samples.splice(0, samples.length, {
    name: "provided-local-file",
    data: await readFile(process.argv[2]),
  });
}
const results = [];
for (const sample of samples) {
  for (const [algorithm, level] of [
    ["gzip", 1],
    ["gzip", 6],
    ["gzip", 9],
    ["br", 4],
    ["br", 6],
    ["br", 11],
  ]) {
    const encode =
      algorithm === "gzip"
        ? () => gzipSync(sample.data, { level })
        : () =>
            brotliCompressSync(sample.data, {
              params: { [constants.BROTLI_PARAM_QUALITY]: level },
            });
    const decode = algorithm === "gzip" ? gunzipSync : brotliDecompressSync;
    for (let i = 0; i < 3; i++) {
      encode();
    }
    const timings = [];
    let output;
    for (let i = 0; i < 15; i++) {
      const start = performance.now();
      output = encode();
      timings.push(performance.now() - start);
    }
    if (!decode(output).equals(sample.data)) {
      throw new Error("Roundtrip failed");
    }
    timings.sort((a, b) => a - b);
    results.push({
      sample: sample.name,
      sha256: createHash("sha256").update(sample.data).digest("hex"),
      rawBytes: sample.data.length,
      algorithm,
      level,
      bytes: output.length,
      savedPercent: +(100 * (1 - output.length / sample.data.length)).toFixed(
        2
      ),
      medianMs: +timings[7].toFixed(3),
      p95Ms: +timings[14].toFixed(3),
      runs: timings.length,
    });
  }
}
const require = createRequire(new URL("apps/web/package.json", root));
const sharp = require("sharp");
const images = [];
for (const name of process.argv[2]
  ? []
  : [
      "grok-bot-submit-dark.png",
      "grok-bot-marketplace-light.png",
      "upstash-content-workflow.png",
    ]) {
  const data = await readFile(new URL(`apps/web/public/blog/${name}`, root));
  const metadata = await sharp(data).metadata();
  for (const mode of [
    "gzip6",
    "webp-lossless",
    "webp80",
    "webp80-1600",
    "avif50-1600",
  ]) {
    const encode = async () => {
      if (mode === "gzip6") {
        return gzipSync(data, { level: 6 });
      }
      let pipeline = sharp(data);
      if (mode.endsWith("1600")) {
        pipeline = pipeline.resize({ width: 1600, withoutEnlargement: true });
      }
      return mode.startsWith("avif")
        ? pipeline.avif({ quality: 50 }).toBuffer()
        : pipeline
            .webp(
              mode === "webp-lossless" ? { lossless: true } : { quality: 80 }
            )
            .toBuffer();
    };
    await encode();
    const timings = [];
    let output;
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      output = await encode();
      timings.push(performance.now() - start);
    }
    if (mode === "gzip6" && !gunzipSync(output).equals(data)) {
      throw new Error("Image gzip roundtrip failed");
    }
    if (mode === "webp-lossless") {
      const before = await sharp(data).ensureAlpha().raw().toBuffer();
      const after = await sharp(output).ensureAlpha().raw().toBuffer();
      if (!before.equals(after)) {
        throw new Error("Lossless pixels differ");
      }
    }
    timings.sort((a, b) => a - b);
    images.push({
      name,
      width: metadata.width,
      height: metadata.height,
      rawBytes: data.length,
      mode,
      bytes: output.length,
      savedPercent: +(100 * (1 - output.length / data.length)).toFixed(2),
      medianMs: +timings[2].toFixed(3),
      maxMs: +timings[4].toFixed(3),
      runs: timings.length,
    });
  }
}
console.log(
  JSON.stringify(
    {
      node: process.version,
      zlib: process.versions.zlib,
      brotli: process.versions.brotli,
      cpu: cpus()[0].model,
      sharp: sharp.versions,
      results,
      images,
    },
    null,
    2
  )
);
