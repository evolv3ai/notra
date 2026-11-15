import { reactDoctorEventWorker } from "./react-doctor-events";

export const sidebarResizeWorker = reactDoctorEventWorker
  .replace("  let actions = 0;", "  const opened = [];\n  let actions = 0;")
  .replace(
    '    useLocale: () => "en",',
    String.raw`    useLocale: () => "en",
    useSidebar: () => ({ state: process.argv[4] === "reexpand" ? "collapsed" : "expanded", setOpen: (value) => opened.push(value) }),`
  )
  .replace(
    "    let target = specifier;",
    String.raw`    if (specifier === "@/constants/nav" || specifier === "@/utils/sidebar-width") continue;
    let target = specifier;`
  )
  .replace(
    'if (mode === "ime") {',
    String.raw`if (mode === "sidebar-resize") {
    const { SIDEBAR_DEFAULT_WIDTH, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH, SIDEBAR_RESIZE_STEP } = await import(resolve("src/constants/nav.ts"));
    const changes = [];
    const finishes = [];
    const styles = [];
    const selectors = [];
    const attributes = [];
    let starts = 0;
    let captured = false;
    const scenario = process.argv[4];
    const width = SIDEBAR_DEFAULT_WIDTH;
    const tree = render({ width, onWidthChange: (value) => changes.push(value), onWidthChangeEnd: (value) => finishes.push(value), onWidthChangeStart: () => { starts++; } });
    const handlers = tree.props;
    const target = {
      setAttribute: (...args) => attributes.push(args),
      setPointerCapture() { captured = true; },
      hasPointerCapture() { return captured; },
      releasePointerCapture() {
        captured = false;
        handlers.onLostPointerCapture(event);
      },
      closest(selector) {
        selectors.push(selector);
        return scenario === "fallback" ? null : { style: { setProperty: (...args) => styles.push(args) } };
      },
    };
    const event = { button: 0, pointerId: 1, clientX: 100, currentTarget: target, preventDefault() {} };
    if (scenario === "keyboard") {
      handlers.onKeyDown({ key: "ArrowRight", preventDefault() {} });
      handlers.onKeyDown({ key: "Home", preventDefault() {} });
      handlers.onKeyDown({ key: "End", preventDefault() {} });
      assert.deepEqual(changes, [Math.min(width + SIDEBAR_RESIZE_STEP, SIDEBAR_MAX_WIDTH), SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH]);
      assert.deepEqual(finishes, changes);
    } else if (scenario === "doubleclick") {
      handlers.onDoubleClick();
      assert.deepEqual(opened, [true]);
      assert.deepEqual(changes, [SIDEBAR_DEFAULT_WIDTH]);
      assert.deepEqual(finishes, changes);
    } else if (scenario === "collapse" || scenario === "reexpand") {
      handlers.onPointerDown(event);
      const clientX = scenario === "collapse" ? 100 + SIDEBAR_MIN_WIDTH - width - 41 : 140;
      if (scenario === "reexpand") {
        handlers.onPointerMove({ ...event, clientX: 139 });
        assert.deepEqual(opened, [], "wait until the expansion threshold");
        assert.deepEqual(finishes, []);
      }
      handlers.onPointerMove({ ...event, clientX });
      assert.deepEqual(opened, [scenario === "reexpand"]);
      assert.deepEqual(finishes, [scenario === "collapse" ? SIDEBAR_MIN_WIDTH : width]);
      assert.deepEqual(changes, []);
      assert.equal(captured, false);
      handlers.onPointerUp(event);
      handlers.onLostPointerCapture(event);
      assert.equal(finishes.length, 1, "automatic collapse or expansion finishes only once");
      if (scenario === "collapse") {
        assert.deepEqual(styles, [["--sidebar-width", SIDEBAR_MIN_WIDTH + "px"]]);
        assert.deepEqual(attributes, [["aria-valuenow", String(SIDEBAR_MIN_WIDTH)], ["aria-valuetext", "widthPixels"]]);
      } else {
        assert.deepEqual(styles, []);
        assert.deepEqual(attributes, []);
      }
    } else {
      handlers.onPointerMove({ ...event, clientX: 110 });
      assert.deepEqual(changes, [], "ignore moves before a drag starts");
      assert.deepEqual(styles, []);
      handlers.onPointerDown(event);
      assert.equal(starts, 1);
      handlers.onPointerMove({ ...event, clientX: 102 });
      assert.deepEqual(styles, [], "preserve the drag threshold");
      handlers.onPointerMove({ ...event, clientX: 110 });
      if (scenario !== "fallback") {
        assert.deepEqual(attributes, [["aria-valuenow", String(width + 10)], ["aria-valuetext", "widthPixels"]]);
      }
      handlers.onPointerMove({ ...event, clientX: 120 });
      if (scenario !== "fallback") {
        assert.deepEqual(attributes, [["aria-valuenow", String(width + 10)], ["aria-valuetext", "widthPixels"], ["aria-valuenow", String(width + 20)], ["aria-valuetext", "widthPixels"]]);
      }
      assert.deepEqual(finishes, [], "do not persist intermediate drag widths");
      assert.deepEqual(selectors, ['[data-slot="sidebar-wrapper"]', '[data-slot="sidebar-wrapper"]']);
      if (scenario === "fallback") {
        assert.deepEqual(styles, []);
        assert.deepEqual(changes, [width + 10, width + 20], "retain callback fallback outside a sidebar wrapper");
      } else {
        assert.deepEqual(styles, [["--sidebar-width", (width + 10) + "px"], ["--sidebar-width", (width + 20) + "px"]]);
        assert.deepEqual(changes, [], "pointer moves must not update shell React state");
      }
      if (scenario === "lostcapture") {
        captured = false;
        handlers.onLostPointerCapture(event);
      } else if (scenario === "cancel") {
        handlers.onPointerCancel(event);
      } else {
        handlers.onPointerUp(event);
      }
      handlers.onLostPointerCapture(event);
      handlers.onPointerUp(event);
      handlers.onPointerCancel(event);
      assert.deepEqual(finishes, [width + 20], "finish exactly once even when releasing capture synchronously triggers lostcapture");
      assert.equal(captured, false);
      handlers.onPointerMove({ ...event, clientX: 130 });
      assert.equal(selectors.length, 2, "ignore moves after the drag finishes");
    }
  } else if (mode === "ime") {`
  );
