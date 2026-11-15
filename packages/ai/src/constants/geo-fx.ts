export const GEO_FX_DIRECTORY = "/workspace/home/notra-fx";
export const GEO_FX_HARNESS_PATH = `${GEO_FX_DIRECTORY}/harness.mjs`;
export const GEO_FX_USAGE_TOOL_ID = "notra-fx-usage";
export const GEO_FX_INSTALL_COMMAND = `set -eu
mkdir -p ${GEO_FX_DIRECTORY}/bin
cd ${GEO_FX_DIRECTORY}/bin
case "$(uname -m)" in
  aarch64|arm64) arch=aarch64 ;;
  x86_64) arch=x86_64 ;;
  *) exit 1 ;;
esac
file="fx-linux-$arch.tar.gz"
curl --connect-timeout 10 --max-time 30 -fsSL "https://github.com/vercel-labs/fx/releases/download/v0.0.13/$file" -o "$file"
curl --connect-timeout 10 --max-time 30 -fsSL "https://github.com/vercel-labs/fx/releases/download/v0.0.13/$file.sha256" -o "$file.sha256"
sha256sum -c "$file.sha256"
tar -xzf "$file"
./fx --version`;

export const GEO_FX_HARNESS_SOURCE = String.raw`
import http from "node:http";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const args = process.argv.slice(2);
const value = name => args.indexOf(name) >= 0 ? args[args.indexOf(name) + 1] : undefined;
const model = value("--model");
const input = value("-p");
let envelope;
try { const parsed = JSON.parse(input); if (parsed.kind === "notra_fx_prompt") envelope = parsed; } catch {}
const prompt = envelope?.prompt ?? input;
const requestedTimeout = Number(value("--timeout-ms") ?? envelope?.timeoutMs ?? 130_000);
const deadline = Date.now() + Math.max(1, Math.min(130_000, Number.isFinite(requestedTimeout) ? requestedTimeout : 130_000));
const deadlineController = new AbortController();
const home = value("--home") ?? "/workspace/home/notra-fx/home";
const binary = value("--binary") ?? "/workspace/home/notra-fx/bin/fx";
const gateway = "https://ai-gateway.vercel.sh";
const records = [];
const pending = new Set();
const controllers = new Set();
const emit = (event, data) => process.stdout.write("event: " + event + "\ndata: " + JSON.stringify(data) + "\n\n");
const bounded = number => Number.isFinite(number) && number >= 0;
let posts = 0;
let child;
let stopped = false;
let timedOut = false;
let killTimer;
const stop = () => {
  stopped = true;
  child?.kill("SIGTERM");
  if (child && child.exitCode === null && child.signalCode === null && !killTimer) killTimer = setTimeout(() => child.kill("SIGKILL"), 2000);
  for (const controller of controllers) controller.abort();
};
process.once("SIGTERM", stop);
process.once("SIGINT", stop);

function accounting() {
  const deduplicated = [...new Map(records.map((record, index) => [record.generationId ?? index, record])).values()];
  const known = deduplicated.filter(record => record.usage && record.cost !== undefined);
  const usage = {
    modelId: model,
    inputTokens: known.reduce((sum, record) => sum + (record.usage.inputTokens?.total ?? 0), 0),
    outputTokens: known.reduce((sum, record) => sum + (record.usage.outputTokens?.total ?? 0), 0),
    cacheReadTokens: known.reduce((sum, record) => sum + (record.usage.inputTokens?.cacheRead ?? 0), 0),
    cacheWriteTokens: known.reduce((sum, record) => sum + (record.usage.inputTokens?.cacheWrite ?? 0), 0),
    reasoningTokens: known.reduce((sum, record) => sum + (record.usage.outputTokens?.reasoning ?? 0), 0),
    totalUsd: known.reduce((sum, record) => sum + record.cost, 0),
  };
  return { deduplicated, known, usage };
}

function capture(record, event) {
  const metadata = event.providerMetadata?.gateway;
  if (metadata?.generationId) record.generationId = metadata.generationId;
  if (event.type === "text-start") record.phases.set(event.id, event.providerMetadata?.openai?.phase);
  if (event.type === "text-delta" && record.phases.get(event.id) !== "commentary") record.text += event.delta;
  if (event.type === "tool-call") emit("tool", { toolCallId: event.toolCallId, name: event.toolName, input: event.input });
  if (event.type === "tool-result") {
    record.text = "";
    const result = event.result ?? event.output;
    const output = event.toolName === "exa_search" && Array.isArray(result?.results)
      ? result.results.map(({ url, title }) => ({ url, title }))
      : result;
    emit("tool_result", { toolCallId: event.toolCallId, output });
  }
  if (event.type === "finish") {
    record.finished = true;
    record.finishReason = event.finishReason?.unified;
    record.model = metadata?.routing?.originalModelId;
    record.usage = event.usage;
    if (metadata?.marketCost !== undefined && bounded(Number(metadata.marketCost))) record.cost = Number(metadata.marketCost);
    if (record.usage && record.cost !== undefined) emit("tool_result", { toolCallId: "notra-fx-usage", output: { kind: "notra_fx_usage", verified: false, costBasis: "gateway.marketCost", usage: accounting().usage } });
  }
}

const server = http.createServer(async (request, response) => {
  if (stopped || !model || !prompt || !["/v3/ai/language-model", "/coding-agent/v1/models", "/v1/models"].includes(request.url)) {
    response.writeHead(404).end();
    return;
  }
  const record = { text: "", phases: new Map(), inference: request.method === "POST" };
  if (record.inference) {
    records.push(record);
    if (++posts > 40) { response.writeHead(429).end(); return; }
    if (records.reduce((sum, entry) => sum + (entry.cost ?? 0), 0) >= 2) { response.writeHead(429).end(); return; }
  }
  const controller = new AbortController();
  controllers.add(controller);
  response.once("close", () => { if (!response.writableFinished) controller.abort(); });
  const forwarding = (async () => {
    try {
      const parts = [];
      let bytes = 0;
      for await (const part of request) {
        bytes += part.length;
        if (bytes > 2_000_000) throw new Error("Request too large");
        parts.push(part);
      }
      const headers = new Headers();
      for (const [name, entry] of Object.entries(request.headers)) {
        if (entry && !["host", "authorization", "content-length", "connection"].includes(name)) headers.set(name, Array.isArray(entry) ? entry.join(",") : entry);
      }
      const upstream = await fetch(gateway + request.url, {
        method: request.method,
        headers,
        body: request.method === "GET" ? undefined : Buffer.concat(parts),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(120_000)]),
      });
      record.status = upstream.status;
      response.writeHead(upstream.status, Object.fromEntries([...upstream.headers].filter(([name]) => !["content-length", "content-encoding", "transfer-encoding"].includes(name))));
      const [client, evidence] = upstream.body.tee();
      await Promise.allSettled([
        pipeline(Readable.fromWeb(client), response),
        (async () => {
          const decoder = new TextDecoder();
          let buffer = "";
          let bytes = 0;
          for await (const part of evidence) {
            bytes += part.length;
            if (bytes > 2_000_000) { controller.abort(); throw new Error("Response too large"); }
            buffer += decoder.decode(part, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop();
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              try { capture(record, JSON.parse(line.slice(6))); } catch {}
            }
          }
        })(),
      ]);
    } catch {
      if (!response.headersSent) response.writeHead(502);
      response.end();
    } finally {
      controllers.delete(controller);
    }
  })();
  pending.add(forwarding);
  try { await forwarding; } finally { pending.delete(forwarding); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = "http://127.0.0.1:" + server.address().port;
fs.mkdirSync(home + "/workspace", { recursive: true });
const environment = {
  PATH: process.env.PATH, HOME: home, LANG: "C.UTF-8",
  FX_AUTH_MODE: "host-managed", FX_PROVIDER: "gateway", FX_DISABLE_KEYCHAIN: "1",
  FX_SKIP_ONBOARDING: "1", FX_AUTO_UPGRADE: "0", FX_MAX_AGENT_STEPS: "8",
  FX_GATEWAY_BASE_URL: base, FX_GATEWAY_CHAT_URL: base + "/v3/ai/language-model",
  FX_WEB_SEARCH_BACKEND: "ai_gateway_exa_search",
};
for (const name of ["NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE", "SSL_CERT_DIR", "HTTPS_PROXY", "HTTP_PROXY", "NO_PROXY"]) {
  if (process.env[name]) environment[name] = process.env[name];
}
let stdout = "";
let failure;
const timer = setTimeout(() => { timedOut = true; deadlineController.abort(); stop(); }, Math.max(1, deadline - Date.now()));
try {
  if (!model || !prompt) throw new Error("Missing fx model or prompt");
  child = spawn(binary, ["ask", "--json", "--no-save", "--no-color", "--model", model, "--no-ultrafast", prompt], { cwd: home + "/workspace", env: environment, stdio: ["ignore", "pipe", "ignore"] });
  child.stdout.on("data", part => { stdout += part; if (stdout.length > 2_000_000) stop(); });
  const code = await new Promise((resolve, reject) => { child.once("close", code => { clearTimeout(killTimer); resolve(code); }); child.once("error", reject); });
  await Promise.allSettled([...pending]);
  const result = JSON.parse(stdout);
  if (code !== 0 || result.exit_code !== 0 || !result.final_output?.trim() || stopped) throw new Error("fx did not complete its answer");
} catch { failure = "fx did not complete its answer"; }
stop();
await Promise.allSettled([...pending]);
for (const record of accounting().deduplicated) {
  if ((record.cost !== undefined && record.usage) || !record.generationId) continue;
  for (let attempt = 0; attempt < 3; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0 || deadlineController.signal.aborted) { timedOut = true; break; }
    try {
      const response = await fetch(gateway + "/v1/generation?id=" + encodeURIComponent(record.generationId), { signal: AbortSignal.any([deadlineController.signal, AbortSignal.timeout(Math.min(3000, remaining))]) });
      if (response.ok) {
        const data = (await response.json()).data;
        if (bounded(data?.market_cost)) record.cost = data.market_cost;
        if (!record.usage && bounded(data?.tokens_prompt) && bounded(data?.tokens_completion)) record.usage = {
          inputTokens: { total: data.tokens_prompt, cacheRead: data.native_tokens_cached ?? 0, cacheWrite: data.native_tokens_cache_creation ?? 0 },
          outputTokens: { total: data.tokens_completion, reasoning: data.native_tokens_reasoning ?? 0 },
        };
        emit("tool_result", { toolCallId: "notra-fx-usage", output: { kind: "notra_fx_usage", verified: false, costBasis: "gateway.marketCost", usage: accounting().usage } });
        if (record.cost !== undefined && record.usage) break;
      }
    } catch {}
    if (attempt < 2 && deadline - Date.now() > 500) await new Promise(resolve => setTimeout(resolve, 500));
  }
}
const { deduplicated, known, usage } = accounting();
const answer = deduplicated.at(-1);
timedOut ||= Date.now() >= deadline;
const verified = !failure && !timedOut && answer?.finished && answer.finishReason === "stop" && answer.model === model && Boolean(answer.text.trim()) && known.length === deduplicated.length && known.length > 0;
emit("tool_result", { toolCallId: "notra-fx-usage", output: { kind: "notra_fx_usage", verified: Boolean(verified), ...(timedOut ? { timedOut: true } : {}), costBasis: "gateway.marketCost", usage } });
if (verified) {
  emit("text", { text: answer.text });
  emit("done", { output: answer.text, input_tokens: usage.inputTokens, output_tokens: usage.outputTokens, cached_input_tokens: usage.cacheReadTokens, total_cost_usd: usage.totalUsd });
} else {
  emit("error", { error: failure ?? "fx returned no verified answer or incomplete usage" });
  process.exitCode = 1;
}
server.closeAllConnections();
await new Promise(resolve => server.close(resolve));
clearTimeout(timer);
`;
