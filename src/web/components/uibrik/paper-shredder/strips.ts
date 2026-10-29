import * as THREE from "three";

// The shredded paper, in three.js. Each strip is a small piece of cloth: a
// grid of points (rows down its length, COLS across) held together by
// distance constraints, stepped with Verlet integration. Along-strip bend
// constraints rest slightly short, so free strips curl the way cut paper
// does; air drag acts only against a strip's face, so they flutter and
// drift instead of dropping like sticks. Points collide with the bin, its
// floor and every other strip's points, so the strips drape and stack into
// a loose pile.
//
// Everything is in stage pixels with y flipped to point up, so a strip's
// point at z = 0 lands on exactly the pixel the DOM sheet would have.

const SEG = 6; // target length of one cloth segment, px
const MIN_ROWS = 10;
const MAX_ROWS = 64;
const COLS = 3;
const SUBSTEPS = 3;
const ITERATIONS = 10;
const GRAVITY = 1500; // px/s²
const AIR = 5.5; // drag against a strip's face, per second
const DAMP = 0.985; // plain air resistance per substep, so strips reach a paper-like terminal speed
const WIND = 0.018; // the draught out of the cutter, px per substep²
const RADIUS = 2.4; // half the gap kept between strips, px: paper has some loft
const CELL = RADIUS * 2;
const TABLE = 1 << 13;
const LIGHT = new THREE.Vector3(-0.3, 0.55, 0.78).normalize();

/** The sheet about to go in: left edge and size, px. Any height. */
export type SheetBox = { x: number; w: number; h: number };

export type ShredLayout = {
  /** Stage size, px. */
  width: number;
  height: number;
  /** Where strips come out under the body. */
  exitY: number;
  /** Top of the canvas: anything above is hidden by the body anyway. */
  canvasTop: number;
  /** The bin's inside. */
  binLeft: number;
  binRight: number;
  floorY: number;
  /** How far strips may wander towards or away from the viewer, px. */
  depth: number;
  strips: number;
};

type Batch = {
  id: number;
  rows: number;
  gap: number;
  stripW: number;
  seg: number;
  n: number;
  pos: Float32Array; // also the geometry's position array
  prev: Float32Array;
  pinned: Uint8Array;
  owner: Uint16Array; // strip index of each point
  links: Uint16Array; // pairs of point indices
  rest: Float32Array;
  stiff: Float32Array;
  shade: Float32Array;
  normals: Float32Array;
  geometry: THREE.BufferGeometry;
  front: THREE.Mesh;
  back: THREE.Mesh;
  texture: THREE.Texture;
  released: boolean;
  topFrom: number;
  topTo: number;
  still: number; // frames without real movement
  asleep: boolean;
  fade: number; // 1 while shown, falls to 0 before removal
  fading: boolean;
  clock: number;
  phase: Float32Array; // per strip, so they sway out of step
};

const idx = (rows: number, strip: number, row: number, col: number) => (strip * rows + row) * COLS + col;

export class ShredScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private batches: Batch[] = [];
  private layout: ShredLayout;
  private head = new Int32Array(TABLE);
  private next = new Int32Array(0);
  private refs = new Int32Array(0); // batch slot * stride + point
  private stride = 0;

  constructor(canvas: HTMLCanvasElement, layout: ShredLayout) {
    this.layout = layout;
    const h = layout.height - layout.canvasTop;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(layout.width, h, false);
    this.renderer.setClearColor(0x000000, 0);

    // A gentle perspective, placed so the z = 0 plane maps 1:1 onto the stage.
    const fov = 30;
    const distance = h / 2 / Math.tan((fov * Math.PI) / 360);
    this.camera = new THREE.PerspectiveCamera(fov, layout.width / h, 1, distance * 3);
    this.camera.position.set(layout.width / 2, -(layout.canvasTop + h / 2), distance);
  }

  /**
   * New strips for the sheet about to go in, textured from `paper`. The sheet
   * can be any height: each batch sizes its own cloth to it. A batch that
   * never went through (the sheet slid back out) is dropped first.
   */
  begin(id: number, paper: HTMLCanvasElement | HTMLImageElement | Promise<HTMLCanvasElement>, paperColor: string, top: number, sheet: SheetBox) {
    for (const x of this.batches.filter((x) => !x.released)) this.remove(x);
    const L = this.layout;
    const S = L.strips;
    const rows = Math.min(MAX_ROWS, Math.max(MIN_ROWS, Math.round(sheet.h / SEG) + 1));
    const gap = sheet.w / S;
    const stripW = gap - 1.2;
    const seg = sheet.h / (rows - 1);
    const n = S * rows * COLS;
    const pos = new Float32Array(n * 3);
    const prev = new Float32Array(n * 3);
    const owner = new Uint16Array(n);
    const uv = new Float32Array(n * 2);
    const shade = new Float32Array(n * 3).fill(1);
    // The sheet carries straight on through the body: a point comes out
    // of the bottom only once it has travelled the body's full depth.
    const offset = top;

    for (let s = 0; s < S; s++) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < COLS; c++) {
          const i = idx(rows, s, r, c);
          const across = (c / (COLS - 1)) * stripW;
          pos[i * 3] = prev[i * 3] = sheet.x + s * gap + across;
          pos[i * 3 + 1] = prev[i * 3 + 1] = -(offset + r * seg);
          owner[i] = s;
          uv[i * 2] = (s * gap + across) / sheet.w;
          uv[i * 2 + 1] = 1 - r / (rows - 1);
        }
      }
    }

    // Constraints: edges, cross-braces, and bends that rest a touch short so
    // the strips curl. Each strip gets its own curl.
    const links: number[] = [];
    const rest: number[] = [];
    const stiff: number[] = [];
    const link = (a: number, b: number, length: number, k: number) => {
      links.push(a, b);
      rest.push(length);
      stiff.push(k);
    };
    const across = stripW / (COLS - 1);
    const diag = Math.hypot(across, seg);
    for (let s = 0; s < S; s++) {
      // Cut paper curls gently along its length: a radius of a couple of
      // hundred px, set per strip. Spans of two and three segments rest at
      // the chord of that arc, so the strip holds the curve and resists folding.
      const radius = 120 + Math.random() * 160;
      const chord = (k: number) => 2 * radius * Math.sin((k * seg) / (2 * radius));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < COLS; c++) {
          if (c < COLS - 1) link(idx(rows, s, r, c), idx(rows, s, r, c + 1), across, 1);
          if (r < rows - 1) {
            link(idx(rows, s, r, c), idx(rows, s, r + 1, c), seg, 1);
            if (c < COLS - 1) {
              link(idx(rows, s, r, c), idx(rows, s, r + 1, c + 1), diag, 0.6);
              link(idx(rows, s, r, c + 1), idx(rows, s, r + 1, c), diag, 0.6);
            }
          }
          // Paper is stiff to bend, much stiffer than cloth.
          if (r < rows - 2) link(idx(rows, s, r, c), idx(rows, s, r + 2, c), chord(2), 0.7);
          if (r < rows - 3) link(idx(rows, s, r, c), idx(rows, s, r + 3, c), chord(3), 0.4);
        }
        link(idx(rows, s, r, 0), idx(rows, s, r, COLS - 1), stripW, 0.5);
      }
    }

    const index: number[] = [];
    for (let s = 0; s < S; s++) {
      for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < COLS - 1; c++) {
          const a = idx(rows, s, r, c);
          const b = idx(rows, s, r, c + 1);
          const d = idx(rows, s, r + 1, c);
          const e = idx(rows, s, r + 1, c + 1);
          index.push(a, d, e, a, e, b);
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geometry.setAttribute("color", new THREE.BufferAttribute(shade, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setIndex(index);

    // Safari can fail to replace a zero-sized texture after the first upload.
    // Start with a valid 1×1 paper-coloured canvas and resize it in place.
    const placeholder = document.createElement("canvas");
    placeholder.width = 1;
    placeholder.height = 1;
    const placeholder_ctx = placeholder.getContext("2d");
    if (placeholder_ctx) {
      placeholder_ctx.fillStyle = "#ffffff";
      placeholder_ctx.fillRect(0, 0, 1, 1);
    }

    // Use the already-decoded image as the WebGL texture source when
    // possible. Safari's canvas upload path can produce blank AVIF textures,
    // while an HTMLImageElement is handled by the native image decoder.
    const texture = paper instanceof HTMLCanvasElement
      ? new THREE.CanvasTexture(paper)
      : paper instanceof HTMLImageElement
        ? new THREE.Texture(paper)
        : new THREE.CanvasTexture(placeholder);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    if (paper instanceof Promise) {
      paper.then((img) => {
        texture.image = img;
        texture.needsUpdate = true;
      });
    }

    // Printed on the front only; the back is plain paper. Shading is baked
    // into vertex colours each frame, so the paper keeps its exact colour
    // where it faces the viewer.
    const front = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({ map: texture, vertexColors: true, side: THREE.FrontSide, transparent: true }),
    );
    const back = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({ color: new THREE.Color(paperColor), vertexColors: true, side: THREE.BackSide, transparent: true }),
    );
    // Later batches draw over older ones where they touch.
    front.renderOrder = back.renderOrder = id;
    this.scene.add(front, back);

    // Only the newest pile stays; older ones fade out.
    const piles = this.batches.filter((x) => x.released && !x.fading);
    piles.slice(0, -1).forEach((x) => (x.fading = true));

    const batch: Batch = {
      id,
      rows,
      gap,
      stripW,
      seg,
      n,
      pos,
      prev,
      pinned: new Uint8Array(n).fill(1),
      owner,
      links: Uint16Array.from(links),
      rest: Float32Array.from(rest),
      stiff: Float32Array.from(stiff),
      shade,
      normals: new Float32Array(n * 3),
      geometry,
      front,
      back,
      texture,
      released: false,
      topFrom: top,
      topTo: top,
      still: 0,
      asleep: false,
      fade: 1,
      fading: false,
      clock: 0,
      phase: Float32Array.from({ length: S }, () => Math.random() * Math.PI * 2),
    };
    this.batches.push(batch);
  }

  /** Where the sheet's top edge is now; the part still inside the body follows it. */
  feed(id: number, top: number) {
    const b = this.batches.find((x) => x.id === id);
    if (b && !b.released) b.topTo = top;
  }

  /** The sheet has gone through: every strip is free. */
  release(id: number) {
    const b = this.batches.find((x) => x.id === id);
    if (!b) return;
    b.released = true;
    b.pinned.fill(0);
  }

  /** Advances the simulation and draws. False once nothing is moving. */
  step(dt: number) {
    if (!this.batches.length) return false;
    const h = dt / SUBSTEPS;
    for (let k = 0; k < SUBSTEPS; k++) {
      const t = (k + 1) / SUBSTEPS;
      for (const b of this.batches) {
        if (b.asleep) continue;
        this.pin(b, b.topFrom + (b.topTo - b.topFrom) * t);
        this.integrate(b, h);
      }
      this.buildGrid();
      for (let it = 0; it < ITERATIONS; it++) {
        for (const b of this.batches) if (!b.asleep) this.solve(b);
      }
      for (const b of this.batches) if (!b.asleep) this.collide(b);
    }

    let active = false;
    for (const b of this.batches) {
      // A batch still waiting for its sheet, entirely inside the body, needs no frames.
      if (!b.asleep && (b.released || b.pinned.includes(0) || b.topFrom !== b.topTo)) {
        active = true;
        this.settle(b);
      }
      b.topFrom = b.topTo;
      if (b.fading) {
        active = true;
        b.fade = Math.max(0, b.fade - dt * 2.5);
        (b.front.material as THREE.MeshBasicMaterial).opacity = b.fade;
        (b.back.material as THREE.MeshBasicMaterial).opacity = b.fade;
      }
    }
    for (const b of this.batches.filter((x) => x.fading && x.fade <= 0)) this.remove(b);

    this.renderer.render(this.scene, this.camera);
    return active;
  }

  dispose() {
    for (const b of [...this.batches]) this.remove(b);
    this.renderer.dispose();
  }

  // ─── Simulation ───────────────────────────────────────────────────────────

  // Points still inside the body ride with the sheet; once one passes the
  // exit it's free, already moving at the feed speed.
  private pin(b: Batch, top: number) {
    if (b.released) return;
    const L = this.layout;
    // The sheet carries straight on through the body: a point comes out
    // of the bottom only once it has travelled the body's full depth.
    const offset = top;
    for (let s = 0; s < L.strips; s++) {
      for (let r = 0; r < b.rows; r++) {
        const y = offset + r * b.seg;
        for (let c = 0; c < COLS; c++) {
          const i = idx(b.rows, s, r, c);
          if (!b.pinned[i]) continue;
          if (y >= L.exitY) {
            b.pinned[i] = 0;
            // A nudge out of plane, so each strip picks a way to curl.
            b.pos[i * 3 + 2] += (s % 2 ? 1 : -1) * 0.05 + (Math.random() - 0.5) * 0.04;
            continue;
          }
          b.prev[i * 3 + 1] = b.pos[i * 3 + 1];
          b.pos[i * 3 + 1] = -y;
        }
      }
    }
  }

  private integrate(b: Batch, h: number) {
    const { pos, prev, pinned, normals, owner, phase } = b;
    const g = GRAVITY * h * h;
    const air = Math.min(1, AIR * h);
    b.clock += h;
    // A draught that comes and goes, strongest while the strips hang from
    // the cutter, so they sway and part instead of hanging like a sheet.
    const gust = b.released ? 0.35 : 1;
    for (let i = 0; i < b.n; i++) {
      if (pinned[i]) continue;
      const o = i * 3;
      let vx = (pos[o] - prev[o]) * DAMP;
      let vy = (pos[o + 1] - prev[o + 1]) * DAMP;
      let vz = (pos[o + 2] - prev[o + 2]) * DAMP;
      // Air pushes back only against the face: falling flat is slow,
      // falling edge-first is fast, which is what makes paper flutter.
      const nx = normals[o];
      const ny = normals[o + 1];
      const nz = normals[o + 2];
      const vn = (vx * nx + vy * ny + vz * nz) * air;
      vx -= nx * vn;
      vy -= ny * vn;
      vz -= nz * vn;
      const p = phase[owner[i]];
      const wind = WIND * gust;
      prev[o] = pos[o];
      prev[o + 1] = pos[o + 1];
      prev[o + 2] = pos[o + 2];
      pos[o] += vx + Math.sin(b.clock * 2.3 + p) * wind * 0.5;
      pos[o + 1] += vy - g;
      pos[o + 2] += vz + Math.sin(b.clock * 3.1 + p * 1.7) * wind;
    }
  }

  private solve(b: Batch) {
    const { pos, pinned, links, rest, stiff } = b;
    for (let l = 0; l < rest.length; l++) {
      const a = links[l * 2];
      const c = links[l * 2 + 1];
      const pa = pinned[a];
      const pc = pinned[c];
      if (pa && pc) continue;
      const ao = a * 3;
      const co = c * 3;
      const dx = pos[co] - pos[ao];
      const dy = pos[co + 1] - pos[ao + 1];
      const dz = pos[co + 2] - pos[ao + 2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
      const diff = ((len - rest[l]) / len) * stiff[l];
      const wa = pa ? 0 : pc ? 1 : 0.5;
      const wc = pc ? 0 : pa ? 1 : 0.5;
      pos[ao] += dx * diff * wa;
      pos[ao + 1] += dy * diff * wa;
      pos[ao + 2] += dz * diff * wa;
      pos[co] -= dx * diff * wc;
      pos[co + 1] -= dy * diff * wc;
      pos[co + 2] -= dz * diff * wc;
    }
  }

  private cell(x: number, y: number, z: number) {
    const ix = Math.floor(x / CELL);
    const iy = Math.floor(y / CELL);
    const iz = Math.floor(z / CELL);
    return ((Math.imul(ix, 73856093) ^ Math.imul(iy, 19349663) ^ Math.imul(iz, 83492791)) >>> 0) & (TABLE - 1);
  }

  // Every free point of every batch, bucketed by cell, for the strip-on-strip test.
  private buildGrid() {
    this.head.fill(-1);
    // Batches differ in size now, so the pool is sized to the biggest.
    this.stride = this.batches.reduce((m, b) => Math.max(m, b.n), 1);
    const total = this.batches.length * this.stride;
    if (this.next.length < total) {
      this.next = new Int32Array(total);
      this.refs = new Int32Array(total);
    }
    let k = 0;
    this.batches.forEach((b, slot) => {
      const { pos, pinned } = b;
      for (let i = 0; i < b.n; i++) {
        if (pinned[i]) continue;
        const o = i * 3;
        const c = this.cell(pos[o], pos[o + 1], pos[o + 2]);
        this.refs[k] = slot * this.stride + i;
        this.next[k] = this.head[c];
        this.head[c] = k++;
      }
    });
  }

  private collide(b: Batch) {
    const L = this.layout;
    const { pos, prev, pinned, owner } = b;
    const floor = -L.floorY + RADIUS;
    const min = RADIUS * 2;
    for (let i = 0; i < b.n; i++) {
      if (pinned[i]) continue;
      const o = i * 3;
      let x = pos[o];
      let y = pos[o + 1];
      let z = pos[o + 2];

      // Other strips: push apart, half each (all of it when the other is asleep).
      const cx = Math.floor(x / CELL);
      const cy = Math.floor(y / CELL);
      const cz = Math.floor(z / CELL);
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          for (let oz = -1; oz <= 1; oz++) {
            const c = ((Math.imul(cx + ox, 73856093) ^ Math.imul(cy + oy, 19349663) ^ Math.imul(cz + oz, 83492791)) >>> 0) & (TABLE - 1);
            for (let k = this.head[c]; k >= 0; k = this.next[k]) {
              const ref = this.refs[k];
              const other = this.batches[Math.floor(ref / this.stride)];
              const j = ref % this.stride;
              if (!other || (other === b && (j === i || owner[j] === owner[i]))) continue;
              const p = other.pos;
              const jo = j * 3;
              const dx = x - p[jo];
              const dy = y - p[jo + 1];
              const dz = z - p[jo + 2];
              const d2 = dx * dx + dy * dy + dz * dz;
              if (d2 >= min * min || d2 < 1e-8) continue;
              const d = Math.sqrt(d2);
              const push = (min - d) / d;
              const share = other.asleep ? 1 : 0.5;
              x += dx * push * share;
              y += dy * push * share;
              z += dz * push * share;
              if (!other.asleep) {
                p[jo] -= dx * push * 0.5;
                p[jo + 1] -= dy * push * 0.5;
                p[jo + 2] -= dz * push * 0.5;
              }
            }
          }
        }
      }

      // The bin: floor with friction, side walls, front and back.
      if (y < floor) {
        y = floor;
        prev[o] += (x - prev[o]) * 0.6;
        prev[o + 2] += (z - prev[o + 2]) * 0.6;
      }
      if (x < L.binLeft + RADIUS) x = L.binLeft + RADIUS;
      if (x > L.binRight - RADIUS) x = L.binRight - RADIUS;
      if (z > L.depth) z = L.depth;
      if (z < -L.depth) z = -L.depth;
      pos[o] = x;
      pos[o + 1] = y;
      pos[o + 2] = z;
    }
  }

  // Normals for the air drag and the shading, then the GPU copy. A batch
  // that has stopped moving is put to sleep and becomes part of the floor.
  private settle(b: Batch) {
    const { pos, prev, normals, shade } = b;
    const L = this.layout;
    let moving = 0;
    for (let s = 0; s < L.strips; s++) {
      for (let r = 0; r < b.rows; r++) {
        const r0 = Math.max(0, r - 1);
        const r1 = Math.min(b.rows - 1, r + 1);
        for (let c = 0; c < COLS; c++) {
          const i = idx(b.rows, s, r, c);
          const o = i * 3;
          const a = idx(b.rows, s, r, 0) * 3;
          const e = idx(b.rows, s, r, COLS - 1) * 3;
          const u = idx(b.rows, s, r0, c) * 3;
          const d = idx(b.rows, s, r1, c) * 3;
          // across × along, pointing out of the printed face
          const ax = pos[e] - pos[a];
          const ay = pos[e + 1] - pos[a + 1];
          const az = pos[e + 2] - pos[a + 2];
          const lx = pos[u] - pos[d];
          const ly = pos[u + 1] - pos[d + 1];
          const lz = pos[u + 2] - pos[d + 2];
          let nx = ly * az - lz * ay;
          let ny = lz * ax - lx * az;
          let nz = lx * ay - ly * ax;
          const len = Math.hypot(nx, ny, nz) || 1;
          nx /= len;
          ny /= len;
          nz /= len;
          normals[o] = nx;
          normals[o + 1] = ny;
          normals[o + 2] = nz;
          // Turned from the light it greys; near the floor it sits in shadow.
          const lit = Math.abs(nx * LIGHT.x + ny * LIGHT.y + nz * LIGHT.z);
          const low = Math.min(1, (pos[o + 1] + L.floorY) / 24);
          const v = Math.min(1, 0.74 + 0.32 * lit) * (0.86 + 0.14 * low);
          shade[o] = shade[o + 1] = shade[o + 2] = v;
          const mx = pos[o] - prev[o];
          const my = pos[o + 1] - prev[o + 1];
          const mz = pos[o + 2] - prev[o + 2];
          moving = Math.max(moving, mx * mx + my * my + mz * mz);
        }
      }
    }
    b.geometry.attributes.position.needsUpdate = true;
    b.geometry.attributes.color.needsUpdate = true;
    b.geometry.computeBoundingSphere();
    if (b.released && moving < 0.0004) {
      if (++b.still > 45) b.asleep = true;
    } else b.still = 0;
  }

  private remove(b: Batch) {
    this.scene.remove(b.front, b.back);
    b.geometry.dispose();
    (b.front.material as THREE.Material).dispose();
    (b.back.material as THREE.Material).dispose();
    b.texture.dispose();
    this.batches = this.batches.filter((x) => x !== b);
  }
}
