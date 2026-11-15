import { reactDoctorEventWorker } from "./react-doctor-events";

export const echartsSelectionWorker = reactDoctorEventWorker.replace(
  'if (mode === "ime") {',
  String.raw`if (mode === "selection-callback") {
    const previous = [];
    const current = [];
    const props = { data: [], config: {}, xDataKey: "x" };
    const toggle = find(render({ ...props, onSelectionChange: (key) => previous.push(key) }), "onToggle")[0];
    assert.equal(typeof toggle, "function");
    render({ ...props, onSelectionChange: (key) => current.push(key) });
    toggle("series-a");
    toggle("series-a");
    assert.deepEqual(previous, [], "mounted handlers must not retain the previous callback");
    assert.deepEqual(current, ["series-a", null], "mounted handlers use the latest callback for selection and deselection");
  } else if (mode === "ime") {`
);
