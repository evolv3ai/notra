import assert from "node:assert/strict";

export function validateDashboardSnapshot(data, expectedPath) {
  assert.equal(data.url, expectedPath, "Unexpected dashboard route");
  assert.equal(data.shell, true, "Dashboard shell is missing");
  assert.ok(
    Array.isArray(data.shifts),
    "Layout-shift observer did not initialize"
  );
  assert.ok(Array.isArray(data.headings), "Dashboard headings are missing");
  assert.ok(
    !data.headings.some((heading) =>
      /something went wrong|unexpected error|application error|failed to load|error loading|page not found|^error(?:$|[:!\s])/i.test(
        heading
      )
    ),
    `Dashboard error heading on ${expectedPath}`
  );
  assert.equal(data.fontsLoaded, "loaded", "Dashboard fonts have not loaded");
  assert.equal(data.skeletons, 0, "Dashboard route skeletons remain");
  assert.equal(data.overflow, false, "Dashboard has horizontal overflow");
}

export function validateTransitionFrames(frames, observationMs) {
  assert.ok(
    Array.isArray(frames) && frames.length > 1,
    "Insufficient transition frames"
  );
  assert.ok(
    frames[0].time < observationMs && frames.at(-1).time >= observationMs,
    "Transition sampling ended before the observation window"
  );
  assert.ok(
    frames.every(
      (frame) => frame.shell && frame.sameShell && frame.shellConnected
    ),
    "Dashboard shell was removed or replaced during navigation"
  );
  const pendingObserved = frames.some((frame) => frame.skeletons > 0);
  return {
    shellPreserved: true,
    pendingObserved,
    scenarioExercised: pendingObserved,
  };
}
