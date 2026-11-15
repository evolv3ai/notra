import { spawn } from "node:child_process";
import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  watch,
} from "node:fs";
import { createServer, request } from "node:http";
import type { ClientRequest, IncomingMessage, Server } from "node:http";
import { connect, createServer as createNetServer } from "node:net";
import { dirname, join, relative } from "node:path";
import { pipeline } from "node:stream";
import type { Duplex } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";

import {
  SITE_FAVICON_DIR,
  SITE_FAVICON_HOST,
} from "@notra/sites-core/constants/sites";
import type { SiteDiagnostic } from "@notra/sites-core/types/build";
import type {
  SiteMounts,
  SiteRedirectRule,
} from "@notra/sites-core/types/deployment";
import type { SiteHeadScript } from "@notra/sites-core/types/site-integrations";
import {
  joinMountPath,
  resolveAreaForPath,
} from "@notra/sites-core/utils/mounts";
import { matchRedirect } from "@notra/sites-core/utils/redirects";

import type { BuildParams } from "../src/types/build-params";
import { astroBin } from "./build";
import { AREA_PAGES_FILE } from "./constants/build";
import {
  ASTRO_READY_SCAN_CHARS,
  ASTRO_READY_URL,
  DEV_ERRORS_PATH,
  DEV_FAVICON_URL,
  DEV_HMR_GENERATION_EVENT,
  DEV_PORT_SEARCH_RANGE,
  DEV_PROXY_MAX_ATTEMPTS,
  DEV_PROXY_RETRY_DELAY_MS,
  DEV_PROXY_RETRY_ERRORS,
  DEV_READY_TIMEOUT_MS,
  DEV_STOP_TIMEOUT_MS,
} from "./constants/cli";
import type { DevAreaServer, RunningDevArea } from "./types/dev-server";
import { createAstroLogFilter } from "./utils/astro-log";
import { devErrorPage, devErrorsKey } from "./utils/dev-error-page";
import { isLocalDevHost } from "./utils/dev-host";
import { devMarkdown } from "./utils/dev-markdown";

function retargetHeadScripts(
  scripts: SiteHeadScript[],
  from: string,
  to: string
): SiteHeadScript[] {
  const prefix = from === "/" ? "/" : `${from}/`;
  return scripts.map((script) =>
    script.kind === "external" && script.src.startsWith(prefix)
      ? { ...script, src: joinMountPath(to, script.src.slice(prefix.length)) }
      : script
  );
}

export function paramsForArea(
  params: BuildParams,
  area: DevAreaServer
): BuildParams {
  return {
    ...params,
    area: area.area,
    mount: area.mount,
    headScripts: retargetHeadScripts(
      params.headScripts,
      params.mount,
      area.mount
    ),
  };
}

export async function findFreePort(from: number): Promise<number> {
  for (
    let port = from;
    port < from + DEV_PORT_SEARCH_RANGE && port <= 65535;
    port++
  ) {
    const free = await new Promise<boolean>((resolve) => {
      const probe = createNetServer();
      probe.once("error", () => resolve(false));
      probe.listen(port, "127.0.0.1", () => probe.close(() => resolve(true)));
    });
    if (free) {
      return port;
    }
  }
  throw new Error(
    `No free port between ${from} and ${from + DEV_PORT_SEARCH_RANGE}`
  );
}

// Connects instead of listening: a listen probe would briefly accept
// connections on the port the browser and the user's tools are pointed at.
export async function findUnusedPort(from: number): Promise<number> {
  for (
    let port = from;
    port < from + DEV_PORT_SEARCH_RANGE && port <= 65535;
    port++
  ) {
    const answered = await new Promise<boolean>((resolve) => {
      const socket = connect(port, "127.0.0.1");
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
    });
    if (!answered) {
      return port;
    }
  }
  throw new Error(
    `No free port between ${from} and ${from + DEV_PORT_SEARCH_RANGE}`
  );
}

export async function startAstroDev(
  toolchainRoot: string,
  area: DevAreaServer
): Promise<RunningDevArea | null> {
  const root = join(dirname(area.paramsPath), "astro", area.area);
  area.hmrToken ??= randomBytes(18).toString("base64url");
  area.hmrGeneration = (area.hmrGeneration ?? 0) + 1;
  mkdirSync(root, { recursive: true });
  cpSync(join(toolchainRoot, "src"), join(root, "src"), { recursive: true });
  const tailwindSources = join(root, ".notra", "work");
  mkdirSync(tailwindSources, { recursive: true });
  for (const dir of ["site", "entries"]) {
    const link = join(tailwindSources, dir);
    if (!existsSync(link)) {
      symlinkSync(join(dirname(area.paramsPath), dir), link, "junction");
    }
  }
  const modules = join(dirname(area.paramsPath), "node_modules");
  if (!existsSync(modules)) {
    let dependencyRoot = toolchainRoot;
    while (!existsSync(join(dependencyRoot, "node_modules"))) {
      const parent = dirname(dependencyRoot);
      if (parent === dependencyRoot) {
        throw new Error("Notra Sites runtime dependencies are missing");
      }
      dependencyRoot = parent;
    }
    symlinkSync(join(dependencyRoot, "node_modules"), modules, "junction");
  }
  const sourceWatcher = watch(
    join(toolchainRoot, "src"),
    { recursive: true },
    (_event, filename) => {
      if (!filename) {
        return;
      }
      const source = join(toolchainRoot, "src", filename);
      const destination = join(root, "src", filename);
      try {
        if (existsSync(source)) {
          cpSync(source, destination, { recursive: true });
        } else {
          rmSync(destination, { recursive: true, force: true });
        }
      } catch (error) {
        process.stderr.write(`${String(error)}\n`);
      }
    }
  );
  let running: RunningDevArea | undefined;
  try {
    const child = spawn(
      process.execPath,
      [
        astroBin(toolchainRoot),
        "dev",
        "--ignore-lock",
        "--root",
        root,
        "--config",
        relative(root, join(toolchainRoot, "astro.config.mjs")),
        "--host",
        "127.0.0.1",
        "--port",
        String(area.port),
      ],
      {
        cwd: toolchainRoot,
        env: {
          ...process.env,
          NOTRA_BUILD_PARAMS: area.paramsPath,
          NOTRA_DEV_ROOT: root,
          NOTRA_DEV_MODULES: modules,
          NOTRA_DEV_HMR_TOKEN: `${area.hmrToken}.${area.hmrGeneration}`,
          NOTRA_DEV_DOCUMENT_TOKEN: area.documentToken,
          NOTRA_DEV_HMR_EVENT: DEV_HMR_GENERATION_EVENT,
          NOTRA_DEV_ERRORS_PATH: DEV_ERRORS_PATH,
          ASTRO_TELEMETRY_DISABLED: "1",
          ASTRO_DISABLE_UPDATE_CHECK: "true",
        },
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
    running = { area, child };
    child.once("close", () => sourceWatcher.close());
    child.once("error", () => sourceWatcher.close());
    const port = await new Promise<number | null>((resolve, reject) => {
      const timer = setTimeout(() => resolve(null), DEV_READY_TIMEOUT_MS);
      let ready = false;
      const filterOutput = createAstroLogFilter();
      const watch = (stream: NodeJS.ReadableStream) => {
        let tail = "";
        stream.on("data", (chunk: Buffer) => {
          const text = chunk.toString();
          const filtered = filterOutput(text);
          if (filtered.trim()) {
            process.stderr.write(filtered);
          }
          if (ready) {
            return;
          }
          tail = (tail + text).slice(-ASTRO_READY_SCAN_CHARS);
          const match = ASTRO_READY_URL.exec(tail);
          if (match?.[1]) {
            ready = true;
            clearTimeout(timer);
            resolve(Number(match[1]));
          }
        });
      };
      watch(child.stdout);
      watch(child.stderr);
      child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once("exit", () => {
        clearTimeout(timer);
        resolve(null);
      });
    });
    if (port === null) {
      sourceWatcher.close();
      await stopAstroDev(running);
      return null;
    }
    area.port = port;
    return running;
  } catch (error) {
    sourceWatcher.close();
    if (running) {
      await stopAstroDev(running);
    }
    throw error;
  }
}

export async function stopAstroDev(running: RunningDevArea): Promise<void> {
  const { child } = running;
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, DEV_STOP_TIMEOUT_MS);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

function isDocumentRequest(incoming: IncomingMessage): boolean {
  if (incoming.method !== "GET") {
    return false;
  }
  const destination = incoming.headers["sec-fetch-dest"];
  return destination
    ? destination === "document" ||
        destination === "iframe" ||
        destination === "frame"
    : (incoming.headers.accept ?? "").includes("text/html");
}

function pathnameOf(incoming: IncomingMessage): string | null {
  try {
    return decodeURIComponent(
      new URL(incoming.url ?? "/", "http://localhost").pathname
    );
  } catch {
    return null;
  }
}

function proxyUpgrade(
  incoming: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  target: DevAreaServer
) {
  const upstream = connect(target.port, "127.0.0.1", () => {
    const headers = Object.entries(incoming.headers).flatMap(([name, value]) =>
      (Array.isArray(value) ? value : [value ?? ""]).map(
        (item) => `${name}: ${item}`
      )
    );
    upstream.write(
      `${incoming.method} ${incoming.url} HTTP/${incoming.httpVersion}\r\n${headers.join("\r\n")}\r\n\r\n`
    );
    upstream.write(head);
    upstream.pipe(socket).pipe(upstream);
  });
  upstream.on("error", () => socket.destroy());
  upstream.on("close", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
  socket.on("close", () => upstream.destroy());
}

export function startDevProxy(
  port: number,
  mounts: SiteMounts,
  areas: DevAreaServer[],
  waitForReady: () => Promise<void>,
  siteErrors: () => SiteDiagnostic[] = () => [],
  redirects: () => readonly SiteRedirectRule[] = () => []
): Promise<Server> {
  const [fallback] = areas;
  const targetFor = (pathname: string) => {
    const owner = resolveAreaForPath(mounts, pathname);
    return areas.find((area) => area.area === owner?.area) ?? fallback;
  };
  const server = createServer(async (incoming, outgoing) => {
    if (!isLocalDevHost(incoming.headers.host)) {
      outgoing.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      outgoing.end("Local previews require a loopback host.");
      return;
    }
    try {
      await waitForReady();
    } catch (error) {
      process.stderr.write(`${String(error)}\n`);
      outgoing.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
      outgoing.end("The dev server is restarting, reload in a moment.");
      return;
    }
    if (outgoing.destroyed) {
      return;
    }
    const pathname = pathnameOf(incoming);
    if (pathname === null) {
      outgoing.writeHead(400);
      outgoing.end();
      return;
    }
    if (pathname === DEV_ERRORS_PATH) {
      outgoing.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      const errors = siteErrors();
      outgoing.end(
        JSON.stringify({ count: errors.length, key: devErrorsKey(errors) })
      );
      return;
    }
    const redirect = matchRedirect(redirects(), pathname);
    if (redirect) {
      outgoing.writeHead(redirect.status, {
        location: redirect.location,
        "Cache-Control": "no-store",
      });
      outgoing.end();
      return;
    }
    const errors = siteErrors();
    if (errors.length > 0 && isDocumentRequest(incoming)) {
      outgoing.writeHead(500, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
      outgoing.end(devErrorPage(errors));
      return;
    }
    if (
      areas.some(
        (area) =>
          pathname.replace(/\/+$/, "") ===
          joinMountPath(area.mount, AREA_PAGES_FILE)
      )
    ) {
      outgoing.writeHead(404);
      outgoing.end();
      return;
    }
    // The worker proxies favicons; locally the browser may ask Google directly.
    const faviconHost = pathname.split(`/${SITE_FAVICON_DIR}/`)[1];
    if (faviconHost && SITE_FAVICON_HOST.test(faviconHost)) {
      outgoing.writeHead(302, {
        location: `${DEV_FAVICON_URL}?domain=${faviconHost}&sz=64`,
      });
      outgoing.end();
      return;
    }
    if (fallback && pathname === "/" && !resolveAreaForPath(mounts, pathname)) {
      outgoing.writeHead(302, { location: fallback.mount });
      outgoing.end();
      return;
    }
    const target = targetFor(pathname);
    if (!target) {
      outgoing.writeHead(502);
      outgoing.end();
      return;
    }
    if (
      (incoming.method === "GET" || incoming.method === "HEAD") &&
      pathname.endsWith(".md")
    ) {
      const controller = new AbortController();
      const disconnected = () => controller.abort();
      outgoing.once("close", disconnected);
      incoming.once("aborted", disconnected);
      incoming.once("error", disconnected);
      try {
        const response = await devMarkdown(
          target,
          pathname,
          `http://localhost:${port}`,
          controller.signal
        );
        if (outgoing.destroyed || incoming.method === "HEAD") {
          await response.body?.cancel();
        }
        if (outgoing.destroyed) {
          return;
        }
        const body =
          incoming.method === "HEAD"
            ? undefined
            : Buffer.from(await response.arrayBuffer());
        if (outgoing.destroyed) {
          return;
        }
        outgoing.writeHead(
          response.status,
          Object.fromEntries(response.headers)
        );
        outgoing.end(body);
      } catch (error) {
        if (outgoing.destroyed || controller.signal.aborted) {
          return;
        }
        process.stderr.write(`${String(error)}\n`);
        if (outgoing.headersSent) {
          outgoing.destroy();
          return;
        }
        outgoing.writeHead(502, {
          "Content-Type": "text/plain; charset=utf-8",
        });
        outgoing.end("The dev server is restarting, reload in a moment.");
      } finally {
        outgoing.removeListener("close", disconnected);
        incoming.removeListener("aborted", disconnected);
        incoming.removeListener("error", disconnected);
      }
      return;
    }
    const retryable =
      (incoming.method === "GET" || incoming.method === "HEAD") &&
      incoming.headers["transfer-encoding"] === undefined &&
      (incoming.headers["content-length"] === undefined ||
        incoming.headers["content-length"] === "0");
    const controller = new AbortController();
    let upstream: ClientRequest | undefined;
    let attempts = 0;
    const disconnected = () => {
      controller.abort();
      upstream?.destroy();
    };
    outgoing.once("close", disconnected);
    incoming.once("aborted", disconnected);
    incoming.once("error", disconnected);
    const connectUpstream = () => {
      if (outgoing.destroyed || controller.signal.aborted) {
        return;
      }
      attempts += 1;
      const current = request(
        {
          host: "127.0.0.1",
          port: target.port,
          method: incoming.method,
          path: incoming.url,
          headers: incoming.headers,
        },
        (response) => {
          if (outgoing.destroyed || controller.signal.aborted) {
            response.destroy();
            return;
          }
          outgoing.writeHead(response.statusCode ?? 502, response.headers);
          pipeline(response, outgoing, (error) => {
            if (error) {
              current.destroy();
            }
          });
        }
      );
      upstream = current;
      current.on("error", async (error: NodeJS.ErrnoException) => {
        if (outgoing.destroyed || controller.signal.aborted) {
          return;
        }
        if (outgoing.headersSent) {
          outgoing.destroy();
          return;
        }
        incoming.unpipe(current);
        current.destroy();
        if (
          retryable &&
          attempts < DEV_PROXY_MAX_ATTEMPTS &&
          DEV_PROXY_RETRY_ERRORS.has(error.code ?? "")
        ) {
          try {
            await delay(DEV_PROXY_RETRY_DELAY_MS, undefined, {
              signal: controller.signal,
            });
            if (outgoing.destroyed || controller.signal.aborted) {
              return;
            }
            await waitForReady();
            connectUpstream();
            return;
          } catch {
            if (outgoing.destroyed || controller.signal.aborted) {
              return;
            }
          }
        }
        outgoing.writeHead(502, { "content-type": "text/plain" });
        outgoing.end(
          `The ${target.area} dev server is restarting, reload in a moment.`
        );
      });
      if (attempts === 1) {
        incoming.pipe(current);
      } else {
        current.end();
      }
    };
    connectUpstream();
  });
  server.on("upgrade", async (incoming, socket, head) => {
    if (!isLocalDevHost(incoming.headers.host)) {
      socket.destroy();
      return;
    }
    const disconnected = () => socket.destroy();
    socket.once("error", disconnected);
    socket.once("end", disconnected);
    try {
      await waitForReady();
    } catch {
      socket.destroy();
      return;
    } finally {
      socket.removeListener("error", disconnected);
      socket.removeListener("end", disconnected);
    }
    if (socket.destroyed) {
      return;
    }
    const pathname = pathnameOf(incoming);
    let target = pathname === null ? undefined : targetFor(pathname);
    if (!target) {
      socket.destroy();
      return;
    }
    delete incoming.headers["x-notra-hmr-reload"];
    if (incoming.headers["sec-websocket-protocol"] === "vite-hmr") {
      const url = new URL(incoming.url ?? "/", "http://localhost");
      const [token = "", revision, extra] = (
        url.searchParams.get("token") ?? ""
      ).split(".");
      const generation = Number(revision);
      const supplied = Buffer.from(token);
      const owner = areas.find((area) => {
        if (!area.hmrToken) {
          return false;
        }
        const expected = Buffer.from(area.hmrToken);
        return (
          expected.length === supplied.length &&
          timingSafeEqual(expected, supplied)
        );
      });
      if (
        !owner?.hmrGeneration ||
        extra !== undefined ||
        !Number.isSafeInteger(generation) ||
        generation < 1 ||
        String(generation) !== revision ||
        generation > owner.hmrGeneration
      ) {
        socket.destroy();
        return;
      }
      target = owner;
      if (generation !== owner.hmrGeneration) {
        incoming.headers["x-notra-hmr-reload"] = "1";
        url.searchParams.set(
          "token",
          `${owner.hmrToken}.${owner.hmrGeneration}`
        );
        incoming.url = `${url.pathname}${url.search}`;
      }
    }
    proxyUpgrade(incoming, socket, head, target);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}
