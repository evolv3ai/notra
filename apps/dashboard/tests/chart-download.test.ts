import { afterEach, expect, mock, test } from "bun:test";

import { renderChartPng } from "../src/utils/chart-download";

const originals = new Map<string, PropertyDescriptor | undefined>();

afterEach(() => {
  for (const [key, descriptor] of originals) {
    if (descriptor) {
      Object.defineProperty(globalThis, key, descriptor);
    } else {
      Reflect.deleteProperty(globalThis, key);
    }
  }
  originals.clear();
});

function setupExport({ width = 640, height = 320, dpr = 2 } = {}) {
  const images: string[] = [];
  const attributes = new Map<string, string>();
  const style = { width: "100%", height: "100%" };
  const ctx = {
    beginPath: mock(() => {}),
    moveTo: mock(() => {}),
    arcTo: mock(() => {}),
    closePath: mock(() => {}),
    fill: mock(() => {}),
    drawImage: mock((..._args: unknown[]) => {}),
    measureText: () => ({ width: 30 }),
    save: mock(() => {}),
    restore: mock(() => {}),
    fillText: mock((..._args: unknown[]) => {}),
  };
  const output = {
    width: 0,
    height: 0,
    getContext: () => ctx,
    toBlob: (callback: BlobCallback) =>
      callback(new Blob(["png"], { type: "image/png" })),
  };
  const canvasClass = class {
    width = 1280;
    height = 640;
    clientWidth = 640;
  };
  const canvas = new canvasClass();
  const clone = {
    style,
    setAttribute: (key: string, value: string) => attributes.set(key, value),
    hasAttribute: (key: string) => attributes.has(key),
  };
  const svg = {
    getBoundingClientRect: () => ({ width, height }),
    cloneNode: () => clone,
  };
  let canvases: object[] = [];
  let chartSvg: object | null = svg;
  const source = {
    querySelectorAll: () => canvases,
    querySelector: mock((selector: string) =>
      selector === "[_echarts_instance_] svg" ? chartSvg : { icon: true }
    ),
    closest: () => null,
    parentElement: null,
  };
  const globals = {
    HTMLCanvasElement: canvasClass,
    window: { devicePixelRatio: dpr },
    document: { createElement: () => output },
    getComputedStyle: () => ({
      color: "rgb(0, 0, 0)",
      backgroundColor: "white",
    }),
    XMLSerializer: class {
      serializeToString(value: unknown) {
        expect(value).toBe(clone);
        return `<svg width="${attributes.get("width")}" height="${attributes.get("height")}"/>`;
      }
    },
    Image: class {
      onload = () => {};
      get src() {
        return images.at(-1) ?? "";
      }
      set src(value: string) {
        images.push(decodeURIComponent(value));
        queueMicrotask(() => this.onload());
      }
    },
  };
  for (const [key, value] of Object.entries(globals)) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true });
  }
  return {
    source: source as unknown as HTMLElement,
    querySelector: source.querySelector,
    output,
    ctx,
    images,
    attributes,
    style,
    canvas,
    useCanvas: () => {
      canvases = [{ width: 1, height: 1 }, canvas];
    },
    removeChart: () => {
      chartSvg = null;
    },
  };
}

test("SVG charts export at capped DPR with explicit dimensions, branding and title", async () => {
  const fixture = setupExport({ dpr: 3 });
  const blob = await renderChartPng(fixture.source, "Mention trend");

  expect(blob.type).toBe("image/png");
  expect(fixture.attributes.get("xmlns")).toBe("http://www.w3.org/2000/svg");
  expect(fixture.attributes.get("width")).toBe("1280");
  expect(fixture.attributes.get("height")).toBe("640");
  expect(fixture.attributes.get("viewBox")).toBe("0 0 640 320");
  expect(fixture.style).toEqual({ width: "1280px", height: "640px" });
  expect(fixture.output.width).toBe(1344);
  expect(fixture.output.height).toBe(748);
  expect(fixture.images).toHaveLength(2);
  expect(fixture.ctx.drawImage).toHaveBeenCalledTimes(2);
  expect(fixture.ctx.fillText).toHaveBeenCalledWith("Mention trend", 32, 32);
  expect(fixture.ctx.fillText.mock.calls[0]?.[0]).toBe("Notra");
});

test("SVG charts respect a standard-density display and retain an existing viewBox", async () => {
  const fixture = setupExport({ dpr: 1 });
  fixture.attributes.set("viewBox", "0 0 800 400");
  await renderChartPng(fixture.source, "Trend");
  expect(fixture.attributes.get("width")).toBe("640");
  expect(fixture.attributes.get("viewBox")).toBe("0 0 800 400");
  expect(fixture.output.width).toBe(672);
  expect(fixture.output.height).toBe(374);
});

test("Canvas charts keep their backing resolution and choose the largest canvas", async () => {
  const fixture = setupExport();
  fixture.useCanvas();
  await renderChartPng(fixture.source, "Canvas trend");
  expect(fixture.querySelector).not.toHaveBeenCalled();
  expect(fixture.ctx.drawImage.mock.calls[0]).toEqual([fixture.canvas, 32, 76]);
  expect(fixture.output.width).toBe(1344);
  expect(fixture.output.height).toBe(748);
  expect(fixture.images).toHaveLength(1);
});

test("An icon without a chart SVG cannot be exported as the chart", async () => {
  const fixture = setupExport();
  fixture.removeChart();
  await expect(renderChartPng(fixture.source, "Missing")).rejects.toThrow(
    "Chart is not ready"
  );
  expect(fixture.images).toHaveLength(0);
});

test("Zero-size SVG charts reject before image encoding", async () => {
  const fixture = setupExport({ width: 0 });
  await expect(renderChartPng(fixture.source, "Hidden")).rejects.toThrow(
    "Chart is not ready"
  );
  expect(fixture.images).toHaveLength(0);
});
