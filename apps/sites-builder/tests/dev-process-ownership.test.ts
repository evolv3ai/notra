import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import * as childProcess from "node:child_process";
import type { ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import type { FSWatcher } from "node:fs";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";

import {
  DEV_READY_TIMEOUT_MS,
  DEV_HMR_GENERATION_EVENT,
  DEV_STOP_TIMEOUT_MS,
} from "../compiler/constants/cli";
import * as devServer from "../compiler/dev-server";
import type { DevAreaServer } from "../compiler/types/dev-server";
import { startDevAreas } from "../compiler/utils/dev-areas";

const toolchain = fileURLToPath(new URL("..", import.meta.url));
const area: DevAreaServer = {
  area: "blog",
  mount: "/blog",
  port: 4322,
  paramsPath: "/unused/params.json",
};
const watcher = { close: mock(() => undefined) };

function processDouble(pid?: number) {
  return Object.assign(new PassThrough(), {
    pid,
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    exitCode: null as number | null,
    signalCode: null as NodeJS.Signals | null,
    kill: mock((_signal?: NodeJS.Signals | number) => true),
  });
}

beforeEach(() => {
  watcher.close.mockClear();
  spyOn(fs, "mkdirSync").mockImplementation(() => undefined);
  spyOn(fs, "cpSync").mockImplementation(() => undefined);
  spyOn(fs, "existsSync").mockReturnValue(true);
  spyOn(fs, "watch").mockReturnValue(watcher as unknown as FSWatcher);
});

afterEach(() => mock.restore());

test("watcher acquisition failure never spawns an unowned child", async () => {
  const error = new Error("Unable to watch the renderer");
  spyOn(fs, "watch").mockImplementation(() => {
    throw error;
  });
  const spawn = spyOn(childProcess, "spawn");
  await expect(devServer.startAstroDev(toolchain, { ...area })).rejects.toBe(
    error
  );
  expect(spawn).not.toHaveBeenCalled();
});

test("synchronous spawn failure closes its acquired watcher", async () => {
  const error = new Error("Unable to spawn Astro");
  spyOn(childProcess, "spawn").mockImplementation(() => {
    throw error;
  });
  await expect(devServer.startAstroDev(toolchain, { ...area })).rejects.toBe(
    error
  );
  expect(watcher.close).toHaveBeenCalled();
});

test("asynchronous spawn failure rejects promptly and closes its watcher", async () => {
  const error = new Error("Astro executable is unavailable");
  const child = processDouble();
  spyOn(childProcess, "spawn").mockImplementation((() => {
    queueMicrotask(() => child.emit("error", error));
    return child;
  }) as unknown as typeof childProcess.spawn);
  await expect(devServer.startAstroDev(toolchain, { ...area })).rejects.toBe(
    error
  );
  expect(child.kill).not.toHaveBeenCalled();
  expect(watcher.close).toHaveBeenCalled();
});

test("timed-out startup waits for termination and escalates an ignored SIGTERM", async () => {
  const schedule = globalThis.setTimeout;
  spyOn(globalThis, "setTimeout").mockImplementation(((
    callback: () => void,
    delay?: number
  ) =>
    schedule(
      callback,
      delay === DEV_READY_TIMEOUT_MS || delay === DEV_STOP_TIMEOUT_MS
        ? 1
        : delay
    )) as typeof setTimeout);
  const child = processDouble(12345);
  child.kill.mockImplementation((signal) => {
    if (signal === "SIGKILL") {
      queueMicrotask(() => {
        child.signalCode = "SIGKILL";
        child.emit("exit", null, "SIGKILL");
        child.emit("close", null, "SIGKILL");
      });
    }
    return true;
  });
  spyOn(childProcess, "spawn").mockReturnValue(
    child as unknown as ChildProcess
  );
  expect(await devServer.startAstroDev(toolchain, { ...area })).toBeNull();
  expect(child.kill.mock.calls.map(([signal]) => signal)).toEqual([
    "SIGTERM",
    "SIGKILL",
  ]);
  expect(child.signalCode).toBe("SIGKILL");
  expect(watcher.close).toHaveBeenCalled();
});

test("early child exit returns null and closes the renderer watcher", async () => {
  const child = processDouble(12345);
  spyOn(childProcess, "spawn").mockImplementation((() => {
    queueMicrotask(() => {
      child.exitCode = 1;
      child.emit("exit", 1, null);
      child.emit("close", 1, null);
    });
    return child;
  }) as unknown as typeof childProcess.spawn);
  expect(await devServer.startAstroDev(toolchain, { ...area })).toBeNull();
  expect(watcher.close).toHaveBeenCalled();
});

test("successful startup retains its child, reported port and HMR generation", async () => {
  const child = processDouble(12345);
  const current = { ...area, hmrToken: "session", hmrGeneration: 2 };
  child.kill.mockImplementation(() => {
    queueMicrotask(() => {
      child.signalCode = "SIGTERM";
      child.emit("exit", null, "SIGTERM");
      child.emit("close", null, "SIGTERM");
    });
    return true;
  });
  const spawn = spyOn(childProcess, "spawn").mockImplementation((() => {
    queueMicrotask(() => child.stdout.write("http://127.0.0.1:4400/\n"));
    return child;
  }) as unknown as typeof childProcess.spawn);
  const running = await devServer.startAstroDev(toolchain, current);
  expect(running?.child).toBe(child as unknown as ChildProcess);
  expect(current.port).toBe(4400);
  expect(current.hmrGeneration).toBe(3);
  expect(spawn.mock.calls[0]?.[2]?.env?.NOTRA_DEV_HMR_TOKEN).toBe("session.3");
  expect(watcher.close).not.toHaveBeenCalled();
  if (running) {
    await devServer.stopAstroDev(running);
  }
  expect(watcher.close).toHaveBeenCalled();
});

test("area children share document identity without sharing WebSocket authentication", async () => {
  const current: DevAreaServer[] = [
    {
      ...area,
      hmrToken: "blog-session",
      hmrGeneration: 2,
      documentToken: "document-session.3",
    },
    {
      ...area,
      area: "changelog",
      mount: "/changelog",
      hmrToken: "changelog-session",
      hmrGeneration: 6,
      documentToken: "document-session.3",
    },
  ];
  const children = current.map((_area, index) => {
    const child = processDouble(12345 + index);
    child.kill.mockImplementation(() => {
      queueMicrotask(() => {
        child.signalCode = "SIGTERM";
        child.emit("exit", null, "SIGTERM");
        child.emit("close", null, "SIGTERM");
      });
      return true;
    });
    return child;
  });
  let index = 0;
  const spawn = spyOn(childProcess, "spawn").mockImplementation((() => {
    const child = children[index++];
    if (!child) {
      throw new Error("Unexpected area process");
    }
    queueMicrotask(() => child.stdout.write("http://127.0.0.1:4400/\n"));
    return child;
  }) as unknown as typeof childProcess.spawn);
  const running = await startDevAreas(toolchain, current);
  try {
    expect(running).toHaveLength(2);
    const environments = spawn.mock.calls.map((call) => call[2]?.env);
    expect(environments.map((env) => env?.NOTRA_DEV_DOCUMENT_TOKEN)).toEqual([
      "document-session.3",
      "document-session.3",
    ]);
    expect(environments.map((env) => env?.NOTRA_DEV_HMR_EVENT)).toEqual([
      DEV_HMR_GENERATION_EVENT,
      DEV_HMR_GENERATION_EVENT,
    ]);
    expect(environments.map((env) => env?.NOTRA_DEV_HMR_TOKEN)).toEqual([
      "blog-session.3",
      "changelog-session.7",
    ]);
  } finally {
    await Promise.all((running ?? []).map(devServer.stopAstroDev));
  }
});

test("group startup waits for and stops successful siblings before rejecting", async () => {
  const child = processDouble() as unknown as ChildProcess;
  const running = { area, child };
  const sibling = Promise.withResolvers<typeof running>();
  const error = new Error("Another area failed to start");
  spyOn(devServer, "startAstroDev")
    .mockImplementationOnce(() => sibling.promise)
    .mockRejectedValueOnce(error);
  const stop = spyOn(devServer, "stopAstroDev").mockResolvedValue();
  const starting = startDevAreas(toolchain, [
    area,
    { ...area, area: "changelog", mount: "/changelog" },
  ]);
  await Promise.resolve();
  expect(stop).not.toHaveBeenCalled();
  sibling.resolve(running);
  await expect(starting).rejects.toBe(error);
  expect(stop.mock.calls.map(([entry]) => entry)).toEqual([running]);
});

test("group startup cleans successful siblings when another area returns null", async () => {
  const running = { area, child: processDouble() as unknown as ChildProcess };
  spyOn(devServer, "startAstroDev")
    .mockResolvedValueOnce(running)
    .mockResolvedValueOnce(null);
  const stop = spyOn(devServer, "stopAstroDev").mockResolvedValue();
  expect(
    await startDevAreas(toolchain, [
      area,
      { ...area, area: "changelog", mount: "/changelog" },
    ])
  ).toBeNull();
  expect(stop.mock.calls.map(([entry]) => entry)).toEqual([running]);
});

test("group startup retains every successfully acquired child", async () => {
  const blog = { area, child: processDouble() as unknown as ChildProcess };
  const changelog = {
    area: { ...area, area: "changelog" as const, mount: "/changelog" },
    child: processDouble() as unknown as ChildProcess,
  };
  spyOn(devServer, "startAstroDev")
    .mockResolvedValueOnce(blog)
    .mockResolvedValueOnce(changelog);
  const stop = spyOn(devServer, "stopAstroDev").mockResolvedValue();
  expect(await startDevAreas(toolchain, [blog.area, changelog.area])).toEqual([
    blog,
    changelog,
  ]);
  expect(stop).not.toHaveBeenCalled();
});
