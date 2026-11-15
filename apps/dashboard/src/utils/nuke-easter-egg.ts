import {
  NUKE_BOMB_PALETTE,
  NUKE_BOMB_SPRITE,
  NUKE_COLORS,
  NUKE_CRACKS,
  NUKE_CRATER_RATIO,
  NUKE_DEBRIS,
  NUKE_FADE_MS,
  NUKE_FALL_MS,
  NUKE_FIRE,
  NUKE_FIRE_RAMP,
  NUKE_FLASH_MS,
  NUKE_IMPACT,
  NUKE_MIN_RUBBLE_MS,
  NUKE_PIXEL_SIZE,
  NUKE_REBUILD_MS,
  NUKE_RUBBLE_MS,
  NUKE_SCORCH_RATIO,
  NUKE_SHAKE_MS,
  NUKE_SHAKE_PX,
  NUKE_SHOCKWAVE_MS,
  NUKE_SMOKE,
  NUKE_SMOKE_SPAWN_MS,
} from "@/constants/nuke-easter-egg";
import type { NukeDamage, NukeParticle, Rgb } from "@/types/nuke-easter-egg";

const TRANSPARENT = "rgba(0, 0, 0, 0)";

const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const random = (min: number, max: number) => min + Math.random() * (max - min);
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const rgba = ([r, g, b]: Rgb, alpha: number) =>
  `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
const fireColor = (t: number) => {
  const position = clamp01(t) * (NUKE_FIRE_RAMP.length - 1);
  const index = Math.min(Math.floor(position), NUKE_FIRE_RAMP.length - 2);
  return mix(
    NUKE_FIRE_RAMP[index] as Rgb,
    NUKE_FIRE_RAMP[index + 1] as Rgb,
    position - index
  );
};

export async function nukePage(signal: AbortSignal) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const background =
    [document.body, document.documentElement]
      .map((element) => getComputedStyle(element).backgroundColor)
      .find((color) => color !== TRANSPARENT) ?? "white";

  const { snapdom } = await import("@zumer/snapdom");
  const source = await snapdom.toCanvas(document.body, {
    backgroundColor: background,
    clip: "viewport",
    dpr: 1,
  });
  if (signal.aborted) {
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    height: `${height}px`,
    imageRendering: "pixelated",
    left: "0",
    position: "fixed",
    top: "0",
    width: `${width}px`,
    zIndex: "2147483647",
  });
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const columns = Math.ceil(width / NUKE_PIXEL_SIZE);
  const rows = Math.ceil(height / NUKE_PIXEL_SIZE);
  canvas.width = columns;
  canvas.height = rows;
  context.drawImage(source, 0, 0, columns, rows);
  const pristine = context.getImageData(0, 0, columns, rows);
  context.clearRect(0, 0, columns, rows);
  const world = new ImageData(
    new Uint8ClampedArray(pristine.data),
    columns,
    rows
  );
  const pixelAt = (index: number): Rgb => [
    pristine.data[index] ?? 0,
    pristine.data[index + 1] ?? 0,
    pristine.data[index + 2] ?? 0,
  ];

  const cx = Math.round(columns * NUKE_IMPACT.x);
  const cy = Math.round(rows * NUKE_IMPACT.y);
  const radius = Math.max(
    10,
    Math.round(Math.min(columns, rows) * NUKE_CRATER_RATIO)
  );
  const phases = [random(0, 6), random(0, 6), random(0, 6)];
  const wobble = (angle: number) =>
    1 +
    0.12 * Math.sin(3 * angle + (phases[0] ?? 0)) +
    0.07 * Math.sin(7 * angle + (phases[1] ?? 0)) +
    0.04 * Math.sin(13 * angle + (phases[2] ?? 0));

  const damage: NukeDamage[] = [];
  const reach = Math.ceil(radius * NUKE_SCORCH_RATIO * 1.3);
  for (let y = Math.max(0, cy - reach); y < Math.min(rows, cy + reach); y++) {
    for (
      let x = Math.max(0, cx - reach);
      x < Math.min(columns, cx + reach);
      x++
    ) {
      const dx = x - cx;
      const dy = y - cy;
      const distance = Math.hypot(dx, dy);
      const depth =
        distance / (radius * wobble(Math.atan2(dy, dx))) + random(-0.04, 0.04);
      if (depth > NUKE_SCORCH_RATIO) {
        continue;
      }
      const index = (y * columns + x) * 4;
      let color: Rgb;
      if (depth < 0.72) {
        const shade = mix(
          NUKE_COLORS.craterDeep,
          NUKE_COLORS.craterFloor,
          clamp01(depth / 0.72 + dy / radius / 3)
        );
        color =
          (x + y) % 2 === 0 ? shade : mix(shade, NUKE_COLORS.craterDeep, 0.5);
      } else if (depth < 1) {
        color =
          Math.random() < 0.08
            ? NUKE_COLORS.ember
            : mix(
                NUKE_COLORS.rimDark,
                NUKE_COLORS.rim,
                clamp01(-dy / radius + 0.5)
              );
      } else {
        const heat = 1 - (depth - 1) / (NUKE_SCORCH_RATIO - 1);
        color =
          Math.random() < heat * 0.3
            ? NUKE_COLORS.soot
            : mix(pixelAt(index), NUKE_COLORS.soot, heat ** 1.4 * 0.92);
      }
      damage.push({ color, distance, index, restoreAt: 0 });
    }
  }

  const cracks = Array.from({ length: NUKE_CRACKS }, (_, crack) => {
    const angle = (crack / NUKE_CRACKS) * Math.PI * 2 + random(-0.3, 0.3);
    return {
      angle,
      length: Math.max(columns, rows) * random(0.25, 0.6),
      x: cx + Math.cos(angle) * radius * 0.9,
      y: cy + Math.sin(angle) * radius * 0.9,
    };
  });
  for (let crack = cracks.pop(); crack; crack = cracks.pop()) {
    let { angle, x, y } = crack;
    for (let step = 0; step < crack.length; step++) {
      angle += random(-0.22, 0.22);
      x += Math.cos(angle);
      y += Math.sin(angle);
      const px = Math.round(x);
      const py = Math.round(y);
      if (px < 0 || py < 0 || px >= columns || py >= rows) {
        break;
      }
      const thick = step < crack.length * 0.25 ? [0, 1] : [0];
      for (const offset of thick) {
        damage.push({
          color: NUKE_COLORS.crack,
          distance: Math.hypot(px - cx, py - cy),
          index: (py * columns + px + offset) * 4,
          restoreAt: 0,
        });
      }
      if (Math.random() < 0.006 && crack.length > 20) {
        cracks.push({
          angle: angle + random(-1, 1),
          length: (crack.length - step) * 0.5,
          x,
          y,
        });
      }
    }
  }
  damage.sort((a, b) => a.distance - b.distance);
  const blastRadius = damage.at(-1)?.distance ?? radius;
  for (const hit of damage) {
    hit.restoreAt =
      0.75 * (1 - hit.distance / blastRadius) + 0.25 * Math.random();
  }

  const particles: NukeParticle[] = [];
  const spawn = (
    particle: Partial<NukeParticle> & Pick<NukeParticle, "kind" | "life">
  ) =>
    particles.push({
      age: 0,
      color: NUKE_COLORS.smokeDark,
      drag: 0,
      gravity: 0,
      grow: 0,
      size: 1,
      spread: 0,
      vx: 0,
      vy: 0,
      x: cx,
      y: cy,
      ...particle,
    });
  const detonate = () => {
    for (let i = 0; i < NUKE_DEBRIS; i++) {
      const angle = random(Math.PI * 1.05, Math.PI * 1.95);
      const speed = random(40, 170);
      const x = cx + random(-radius, radius) * 0.7;
      const y = cy + random(-radius, radius) * 0.5;
      spawn({
        color: pixelAt((Math.round(y) * columns + Math.round(x)) * 4),
        gravity: 260,
        kind: "debris",
        life: random(1.2, 2.4),
        size: Math.random() < 0.3 ? 2 : 1,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        x,
        y,
      });
    }
    for (let i = 0; i < NUKE_FIRE; i++) {
      const angle = random(0, Math.PI * 2);
      const speed = random(20, 140);
      spawn({
        drag: 3.2,
        grow: 3,
        kind: "fire",
        life: random(0.6, 1.5),
        size: random(2, 5),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.6 - 20,
      });
    }
  };
  const capRise = rows * 0.42 * 1.4;
  const billow = () => {
    const kind = Math.random();
    if (kind < 0.18) {
      spawn({
        drag: 2.2,
        grow: 2,
        kind: "smoke",
        life: random(1.5, 2.6),
        size: random(3, 5),
        vx: (Math.random() < 0.5 ? -1 : 1) * random(60, 180),
        vy: random(-12, 0),
        x: cx + random(-radius, radius) * 0.6,
        y: cy + random(-2, 3),
      });
      return;
    }
    const cap = kind > 0.55;
    spawn({
      drag: 1.4,
      grow: cap ? 3 : 1.5,
      kind: "smoke",
      life: random(2.6, 4),
      size: cap ? random(4, 7) : random(3, 5),
      spread:
        (Math.random() < 0.5 ? -1 : 1) * (cap ? random(20, 60) : random(0, 6)),
      vx: random(-4, 4),
      vy: -capRise * (cap ? random(0.95, 1.1) : random(0.25, 0.9)),
      x: cx + random(-radius, radius) * (cap ? 0.3 : 0.2),
      y: cy - random(0, 4),
    });
  };

  const drawBomb = (progress: number) => {
    const spriteHeight = NUKE_BOMB_SPRITE.length;
    const top = -spriteHeight - 4 + (cy - spriteHeight + 4 + 4) * progress ** 2;
    const left = cx - 4 + Math.round(Math.sin(progress * 9) * 0.6);
    const shadowWidth = Math.round(2 + 10 * progress);
    context.fillStyle = rgba(NUKE_COLORS.shadow, 0.1 + 0.3 * progress);
    context.fillRect(cx - shadowWidth, cy, shadowWidth * 2 + 1, 1);
    context.fillRect(cx - shadowWidth + 2, cy - 1, shadowWidth * 2 - 3, 3);
    context.fillStyle = "rgba(255, 255, 255, 0.55)";
    for (const streak of [1, 4, 7]) {
      context.fillRect(
        left + streak,
        Math.round(top) - 10 - streak,
        1,
        6 + streak
      );
    }
    for (const [row, line] of NUKE_BOMB_SPRITE.entries()) {
      for (const [column, cell] of [...line].entries()) {
        const fill = NUKE_BOMB_PALETTE[cell];
        if (fill) {
          context.fillStyle = fill;
          context.fillRect(left + column, Math.round(top) + row, 1, 1);
        }
      }
    }
  };

  const drawParticles = (dt: number, fade: number) => {
    for (const particle of particles) {
      particle.age += dt;
      const t = particle.age / particle.life;
      if (t >= 1) {
        continue;
      }
      particle.vx += particle.spread * dt;
      particle.vx *= 1 - Math.min(particle.drag * dt, 1);
      particle.vy *= 1 - Math.min(particle.drag * dt, 1);
      particle.vy += particle.gravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      const size = Math.max(1, Math.round(particle.size + particle.grow * t));
      let color = particle.color;
      let alpha = 1;
      if (particle.kind === "fire") {
        color = fireColor(t);
        alpha = 1 - t ** 3;
      } else if (particle.kind === "smoke") {
        color =
          t < 0.12
            ? fireColor(0.2 + t * 4)
            : mix(
                NUKE_COLORS.smokeDark,
                NUKE_COLORS.smokeLight,
                clamp01((t - 0.12) * 1.6)
              );
        alpha = (1 - t) ** 1.2 * 0.92;
      } else {
        alpha = 1 - t ** 4;
      }
      context.fillStyle = rgba(color, alpha * fade);
      context.fillRect(
        Math.round(particle.x - size / 2),
        Math.round(particle.y - size / 2),
        size,
        size
      );
    }
  };

  const impactAt = NUKE_FALL_MS;
  let rebuildAt = impactAt + NUKE_RUBBLE_MS;
  let skipRequested = false;
  canvas.addEventListener("click", () => {
    skipRequested = true;
  });
  document.body.append(canvas);

  const start = performance.now();
  let previous = start;
  let applied = 0;
  let detonated = false;
  let smokeSpawned = 0;

  try {
    await new Promise<void>((resolve, reject) => {
      const step = (now: number) => {
        if (signal.aborted) {
          resolve();
          return;
        }
        const elapsed = Math.max(now - start, 0);
        const dt = Math.min((now - previous) / 1000, 0.05);
        previous = now;

        if (skipRequested && elapsed > impactAt + NUKE_MIN_RUBBLE_MS) {
          rebuildAt = Math.min(rebuildAt, elapsed);
        }
        const rebuildEnd = rebuildAt + NUKE_REBUILD_MS;

        if (elapsed >= rebuildEnd) {
          const fade = 1 - (elapsed - rebuildEnd) / NUKE_FADE_MS;
          if (fade <= 0) {
            resolve();
            return;
          }
          canvas.style.transform = "";
          canvas.style.opacity = String(fade);
          requestAnimationFrame(frame);
          return;
        }

        const sinceImpact = elapsed - impactAt;
        if (sinceImpact >= 0) {
          const shock =
            blastRadius *
            easeOutCubic(clamp01(sinceImpact / NUKE_SHOCKWAVE_MS));
          for (
            ;
            applied < damage.length &&
            (damage[applied]?.distance ?? 0) <= shock;
            applied++
          ) {
            const hit = damage[applied];
            if (hit) {
              world.data[hit.index] = hit.color[0];
              world.data[hit.index + 1] = hit.color[1];
              world.data[hit.index + 2] = hit.color[2];
            }
          }
        }
        const rebuild = clamp01((elapsed - rebuildAt) / NUKE_REBUILD_MS);
        if (rebuild > 0) {
          for (const hit of damage) {
            if (hit.restoreAt < rebuild) {
              world.data.set(
                pristine.data.subarray(hit.index, hit.index + 4),
                hit.index
              );
            }
          }
        }
        if (sinceImpact < 0) {
          context.clearRect(0, 0, columns, rows);
          drawBomb(clamp01(elapsed / NUKE_FALL_MS));
          requestAnimationFrame(frame);
          return;
        }

        context.putImageData(world, 0, 0);
        if (!detonated) {
          detonated = true;
          detonate();
        }
        const smokeDue = Math.round(
          NUKE_SMOKE * clamp01(sinceImpact / NUKE_SMOKE_SPAWN_MS)
        );
        for (; smokeSpawned < smokeDue; smokeSpawned++) {
          billow();
        }
        drawParticles(dt, 1 - rebuild);

        const wave = sinceImpact / NUKE_SHOCKWAVE_MS;
        if (wave < 1) {
          context.strokeStyle = `rgba(255, 250, 235, ${0.7 * (1 - wave)})`;
          context.lineWidth = 2;
          context.beginPath();
          context.arc(cx, cy, blastRadius * easeOutCubic(wave), 0, Math.PI * 2);
          context.stroke();
        }
        const flash = sinceImpact / NUKE_FLASH_MS;
        if (flash < 1) {
          context.fillStyle = `rgba(255, 252, 240, ${flash < 0.15 ? 1 : 1 - flash})`;
          context.fillRect(0, 0, columns, rows);
        }
        if (sinceImpact < NUKE_SHAKE_MS * 1.6) {
          context.fillStyle = `rgba(255, 120, 40, ${0.22 * (1 - sinceImpact / (NUKE_SHAKE_MS * 1.6))})`;
          context.fillRect(0, 0, columns, rows);
        }
        const shake =
          NUKE_SHAKE_PX * (1 - clamp01(sinceImpact / NUKE_SHAKE_MS)) ** 2;
        canvas.style.transform = `translate(${random(-shake, shake)}px, ${random(-shake, shake)}px)`;

        requestAnimationFrame(frame);
      };
      const frame = (now: number) => {
        try {
          step(now);
        } catch (error) {
          reject(error);
        }
      };
      requestAnimationFrame(frame);
    });
  } finally {
    canvas.remove();
  }
}
