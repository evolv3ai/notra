import { reactDoctorEventWorker } from "./react-doctor-events";

export const echartsRendererWorker = reactDoctorEventWorker
  .replace(
    "  let actions = 0;",
    String.raw`  const effects = [];
  const initializations = [];
  let disposals = 0;
  let resizeCleanups = 0;
  let themeCleanups = 0;
  const mount = { clientWidth: 640, clientHeight: 320 };
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.document = { documentElement: {} };
  globalThis.MutationObserver = class {
    observe() {}
    disconnect() { themeCleanups++; }
  };
  let actions = 0;`
  )
  .replace(
    'initial === null && mode === "ime" ? { blur: action, focus: noop } : initial',
    "index < 2 ? mount : initial"
  )
  .replace(
    "useEffect: noop,",
    "useEffect: (effect, dependencies) => effects.push({ effect, dependencies }),"
  )
  .replace(
    '    buildChartCss: () => "",',
    String.raw`    observeChartResize: () => () => { resizeCleanups++; },
    buildChartCss: () => "",`
  )
  .replace(
    "exports.init = noop;",
    String.raw`exports.init = (...args) => {
        initializations.push(args);
        return new Proxy(chain, {
          get(target, key) {
            if (key === "dispose") return () => { disposals++; };
            return target[key];
          },
        });
      };`
  )
  .replace(
    'if (mode === "ime") {',
    String.raw`if (mode === "renderer") {
    const props = { data: [], config: {}, xDataKey: "x" };
    const requestedRenderer = process.argv[4];
    const chartProps = requestedRenderer === "default" ? props : { ...props, renderer: requestedRenderer };
    render(chartProps);
    const mounted = effects[0];
    const cleanup = mounted.effect();
    assert.equal(initializations.length, 1);
    assert.equal(initializations[0][0], mount, "initialize the mounted element");
    assert.equal(initializations[0][1], undefined, "preserve the default theme");
    assert.deepEqual(initializations[0][2], { renderer: requestedRenderer === "default" ? "canvas" : requestedRenderer });
    assert.equal(typeof cleanup, "function");
    cleanup();
    assert.equal(disposals, 1, "dispose the chart on unmount");
    assert.equal(resizeCleanups, 1, "disconnect resize handling on unmount");
    assert.equal(themeCleanups, 1, "disconnect theme handling on unmount");
  } else if (mode === "ime") {`
  );
