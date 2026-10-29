"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { useReducedMotion } from "motion/react";
import { toCanvas } from "html-to-image";
import { IconFileText } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { ShredScene } from "./strips";

// Paper shredder. Drag the document down into the slot; once its edge is in,
// the motor takes it and pulls it through at a steady speed. The part that
// has gone through comes out the bottom as strips of real paper, simulated
// in three.js (see strips.ts): they hang and sway from the cutter, curl,
// flutter down when the sheet lets go, and drape into a pile in the bin.
//
// The document is whatever you pass as children: any ReactNode, any height.
// It is rendered once at its natural size, measured (offsetWidth/offsetHeight)
// and scaled uniformly to the paper width, so only the *width* is fixed.
// Give the node an explicit width (w-96, style={{ width: 400 }}, ...): that
// width is what gets scaled to fit. The same node is rasterised (html-to-image)
// into the texture of the strips, so the cut lines up with the slot exactly.
//
// Layout, top to bottom: room to pull the sheet up, the sheet, a gap, then the
// machine (a fixed-size block pinned to the bottom). Everything inside the
// machine is in "machine" px: y = 0 is the top of the body.

const DEFAULT_WIDTH = 264; // slot = bin = this wide
const BIN_INSET = 28; // bin (and slot) distance from the stage's side
const BODY_INSET = 16; // body distance from the stage's side
const PAPER_INSET = 14; // the sheet is narrower than the slot by this much per side
const TOP_ROOM = 24; // how far the sheet can be pulled up above rest
const PAPER_GAP = 14; // between the sheet's bottom edge and the top of the body
const BODY_H = 74;
const SLOT_Y = 14; // where the sheet disappears
const BIN_Y = BODY_H; // the strips come out here
const CANVAS_Y = 20; // the strips' canvas starts behind the body
const MACHINE_H = 282;
const FALLBACK_H = 136; // until the node has been measured
const GRAB = 12; // px into the slot before the motor takes over a keyboard shred
const BITE = BIN_Y - SLOT_Y; // px into the slot when paper starts coming out; from here the blades hold it

type Phase = "idle" | "drag" | "settle" | "auto" | "feed" | "gone" | "enter";

export type PaperShredderProps = {
  /**
   * The document to shred: any ReactNode, any height. Give it an explicit
   * width; it is scaled to fit the slot. Swap it (e.g. in onShred) to feed
   * the next one. Defaults to a sample document.
   */
  children?: ReactNode;
  /** Width of the slot, which is also the width of the bin. */
  width?: number;
  /** Columns the cutter makes. */
  strips?: number;
  /** How fast the motor pulls paper through, px/s. */
  speed?: number;
  /** Motor and cutter noise while shredding. */
  sound?: boolean;
  /** Called once a document has gone through. */
  onShred?: () => void;
  className?: string;
};

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// White noise through a band-pass for the cutting, a low saw for the motor.
// Built on the first press, since browsers only start audio from a gesture.
function createMotor() {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 1400;
  band.Q.value = 0.9;
  const hum = ctx.createOscillator();
  hum.type = "sawtooth";
  hum.frequency.value = 92;
  const low = ctx.createBiquadFilter();
  low.type = "lowpass";
  low.frequency.value = 380;
  const humGain = ctx.createGain();
  humGain.gain.value = 0.5;
  const out = ctx.createGain();
  out.gain.value = 0;
  noise.connect(band).connect(out);
  hum.connect(low).connect(humGain).connect(out);
  out.connect(ctx.destination);
  noise.start();
  hum.start();
  return {
    set(on: boolean) {
      if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
      out.gain.setTargetAtTime(on ? 0.16 : 0, ctx.currentTime, on ? 0.03 : 0.09);
    },
    // Paper catching the blades: the cut wanders in pitch while it runs.
    chew() {
      band.frequency.setTargetAtTime(1000 + Math.random() * 1200, ctx.currentTime, 0.02);
    },
    close() {
      if (ctx.state !== "closed") void ctx.close().catch(() => undefined);
    },
  };
}

// ─── The paper's texture ────────────────────────────────────────────────────

const PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** Any CSS colour (oklch included) as sRGB, via a canvas. Transparent comes back as white paper. */
function paperColor(node: HTMLElement): string {
  const el = node.firstElementChild ?? node;
  const css = getComputedStyle(el).backgroundColor;
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!ctx) return "#ffffff";
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return a < 8 ? "#ffffff" : `rgb(${r} ${g} ${b})`;
}

/**
 * Paints the node into a canvas for the strips' texture, at roughly 3x the
 * size it will have on screen. If the browser can't (a tainted image, say),
 * the strips are plain paper instead of the shred failing.
 */
async function rasterize(node: HTMLElement, targetWidth: number): Promise<HTMLCanvasElement> {
  const w = node.offsetWidth || 1;
  const h = node.offsetHeight || 1;
  const ratio = Math.max(0.5, Math.min((3 * targetWidth) / w, 4096 / Math.max(w, h)));
  try {
    await document.fonts?.ready;
    return await toCanvas(node, { pixelRatio: ratio, imagePlaceholder: PIXEL });
  } catch {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = paperColor(node);
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    return canvas;
  }
}

// ─── The shredder's parts ───────────────────────────────────────────────────

/** Fine injection-moulded grain: a black noise at low alpha, multiplied in. */
const GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .6 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>",
)}")`;

/** Monochrome LCD: dark glyphs on the classic grey-green, with a pixel grid and a bezel. */
function Lcd({ text, cursor }: { text: string; cursor: boolean }) {
  return (
    <div
      className="relative rounded-[6px] p-[2.5px]"
      style={{
        background: "linear-gradient(180deg, #3f3f46, #27272a)",
        boxShadow: "0 1px 0 rgb(255 255 255 / 0.55), 0 0 0 0.5px rgb(0 0 0 / 0.35), inset 0 1px 1px rgb(0 0 0 / 0.5)",
      }}
    >
      <div
        className="relative overflow-hidden rounded-[3.5px] px-2 py-[3px]"
        style={{
          background: "#9eac9a",
          boxShadow: "inset 0 1.5px 3px rgb(0 0 0 / 0.4), inset 0 0 0 1px rgb(0 0 0 / 0.1)",
        }}
      >
        {/* the pixel grid */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgb(40 52 38 / 0.1) 1px, transparent 1px), linear-gradient(90deg, rgb(40 52 38 / 0.1) 1px, transparent 1px)",
            backgroundSize: "2px 2px",
          }}
        />
        <span
          className="relative inline-flex items-center whitespace-nowrap font-mono text-[11px] leading-4 tracking-[0.14em]"
          style={{
            color: "#0c110b",
            textShadow: "0.75px 0.75px 0 rgb(12 17 11 / 0.22)",
            minWidth: "calc(14ch + 14 * 0.14em)",
          }}
        >
          {text}
          {cursor && <span aria-hidden className="ps-blink ml-[0.2em] inline-block h-[0.8em] w-[0.5em] bg-current" />}
        </span>
        {/* glare on the cover glass */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(172deg, rgb(255 255 255 / 0.28) 0%, rgb(255 255 255 / 0.06) 38%, transparent 40%)" }}
        />
      </div>
    </div>
  );
}

/** A panel LED: chrome bezel, dark socket, a glass dome that lights from its core. */
function Led({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className="relative block size-[15px] shrink-0 rounded-full"
      style={{
        background: "linear-gradient(150deg, #fafafa 0%, #a1a1aa 48%, #52525b 100%)",
        boxShadow: "0 1px 1.5px rgb(0 0 0 / 0.35), 0 0 0 0.5px rgb(0 0 0 / 0.3), inset 0 0.5px 0 rgb(255 255 255 / 0.9)",
      }}
    >
      {/* socket */}
      <span
        className="absolute inset-[2px] rounded-full"
        style={{ background: "#070a08", boxShadow: "inset 0 1px 2px rgb(0 0 0 / 0.9), 0 0.5px 0 rgb(255 255 255 / 0.5)" }}
      />
      {/* dome, unlit */}
      <span
        className="absolute inset-[3px] rounded-full"
        style={{ background: "radial-gradient(circle at 36% 30%, #4a6654 0%, #1d3527 52%, #0b1a11 100%)" }}
      />
      {/* dome, lit: hot core, glowing body, and light spilling onto the panel */}
      <span
        className="absolute inset-[3px] rounded-full transition-opacity duration-150"
        style={{
          opacity: on ? 1 : 0,
          background: "radial-gradient(circle at 50% 52%, #f2fff8 0%, #8ff5c6 18%, #19c48a 50%, #06795a 100%)",
          boxShadow: "0 0 4px 1px rgb(52 211 153 / 0.85), 0 0 11px 3px rgb(16 185 129 / 0.5), inset 0 -1px 2px rgb(2 60 40 / 0.55)",
        }}
      />
      {/* specular highlight */}
      <span
        className="absolute left-[4.5px] top-[3.5px] h-[3px] w-[4.5px] -rotate-[32deg] rounded-full bg-white/75 blur-[0.4px]"
      />
    </span>
  );
}

/** The sheet shown when the shredder is given nothing to shred. */
function SamplePaper() {
  return (
    <div className="flex h-[136px] w-[220px] flex-col rounded-xl bg-white p-3.5 text-zinc-900 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_rgb(0_0_0/0.06)] dark:bg-zinc-100">
      <div className="flex items-center gap-1.5">
        <IconFileText size={15} stroke={1.75} aria-hidden className="shrink-0 text-zinc-400" />
        <span className="truncate text-[13px] font-medium">Q3 numbers (final).pdf</span>
      </div>
      <div className="mt-3 flex flex-col gap-1.5">
        {[100, 92, 97, 58].map((w) => (
          <span key={w} className="h-1.5 rounded-full bg-zinc-200" style={{ width: `${w}%` }} />
        ))}
      </div>
      <div className="mt-auto flex items-end justify-between gap-2">
        <span className="truncate text-[11px] text-zinc-500">Shared with 3 people</span>
        <span className="shrink-0 -rotate-6 rounded-[5px] px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-red-600 shadow-[inset_0_0_0_1.5px_rgb(220_38_38/0.5)]">
          Confidential
        </span>
      </div>
    </div>
  );
}

// ─── The component ──────────────────────────────────────────────────────────

export function PaperShredder({
  children,
  width = DEFAULT_WIDTH,
  strips: COUNT = 14,
  speed = 150,
  sound = true,
  onShred,
  className,
}: PaperShredderProps) {
  const reduce = useReducedMotion();
  const [running, setRunning] = useState(false);
  const [announce, setAnnounce] = useState("");
  // The node's natural size, as laid out at its own width.
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scene = useRef<ShredScene>(null);
  const motor = useRef<ReturnType<typeof createMotor>>(null);
  const loop = useRef<() => void>(() => {});
  const warmed = useRef<Promise<HTMLCanvasElement> | null>(null);

  // Geometry. Slot, bin and stage all follow `width`; the sheet is scaled
  // uniformly from its natural size to the paper width, so only its height varies.
  const slot_w = Number.isFinite(width) && width > 0 ? width : DEFAULT_WIDTH;
  const stage_w = slot_w + BIN_INSET * 2;
  const paper_w = slot_w - PAPER_INSET * 2;
  const card_x = BIN_INSET + PAPER_INSET;
  const scale = natural ? paper_w / natural.w : 1;
  const paper_h = natural ? natural.h * scale : FALLBACK_H;
  const travel = paper_h + PAPER_GAP + SLOT_Y; // how far the sheet moves from rest until it has gone through
  const layer_h = TOP_ROOM + paper_h + PAPER_GAP + SLOT_Y;
  const root_h = TOP_ROOM + paper_h + PAPER_GAP + MACHINE_H;

  // Everything the loop reads, kept current without restarting it.
  const live = useRef({ speed, sound, reduce, onShred });
  const geo = useRef({ paper_h, travel });
  useIsoLayoutEffect(() => {
    live.current = { speed, sound, reduce, onShred };
    geo.current = { paper_h, travel };
  });

  // Measure the node at its natural size; keep measuring as it changes
  // (images loading, fonts, content swapped for a taller one).
  useIsoLayoutEffect(() => {
    const el = paperRef.current;
    if (!el) return;
    const read = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w > 0 && h > 0) setNatural((p) => (p && p.w === w && p.h === h ? p : { w, h }));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The sheet's position is one number: y, how far it has travelled down from
  // rest (negative while pulled up). Rest is the same spot whatever the height.
  const sim = useRef({
    phase: "idle" as Phase,
    y: 0,
    vel: 0,
    opacity: 1,
    grabY: 0,
    grabFrom: 0,
    batch: 0,
    /** The current batch of strips is still waiting for its sheet. */
    pending: false,
    clock: 0,
    goneAt: 0,
    motorOn: false,
  });
  // px of the sheet that have gone past the slot line.
  const inSlot = (y: number) => y - PAPER_GAP - SLOT_Y;

  // Motor, status light and sound together, only on a change.
  const setMotor = (on: boolean) => {
    const s = sim.current;
    if (s.motorOn === on) return;
    s.motorOn = on;
    setRunning(on);
    if (live.current.sound || !on) motor.current?.set(on);
  };
  const motorRef = useRef(setMotor);
  useEffect(() => {
    motorRef.current = setMotor;
  });

  useEffect(() => {
    let frame = 0;
    let last = 0;
    const s = sim.current;
    s.phase = "idle";
    s.y = 0;
    s.opacity = 1;
    s.vel = 0;
    s.pending = false;
    s.motorOn = false;
    setRunning(false);
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        scene.current = new ShredScene(canvas, {
          width: stage_w,
          height: MACHINE_H,
          exitY: BIN_Y,
          canvasTop: CANVAS_Y,
          binLeft: BIN_INSET + 2,
          binRight: stage_w - BIN_INSET - 2,
          floorY: MACHINE_H - 3,
          // A shallow bin, like a shredder's window: the strips can't lie
          // flat away from view, so they fold and stack up where you see them.
          depth: 9,
          strips: COUNT,
        });
      } catch {
        // No WebGL: the sheet still goes through, it just isn't seen coming out.
        scene.current = null;
      }
    }

    const placeCard = (jitter: number) => {
      const card = cardRef.current;
      if (card) {
        card.style.transform = `translate3d(${jitter}px, ${TOP_ROOM + s.y}px, 0)`;
        card.style.opacity = String(s.opacity);
      }
      if (bodyRef.current) bodyRef.current.style.transform = `translateX(${jitter * 0.6}px)`;
    };

    const tick = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      s.clock += dt;
      const { speed: feedSpeed, reduce: still } = live.current;
      const { paper_h: ph, travel: total } = geo.current;
      let jitter = 0;
      let busy = true;

      if (s.phase === "settle") {
        // Not far enough in: a critically damped spring back to rest.
        const k = 260;
        s.vel += (-k * s.y - 2 * Math.sqrt(k) * s.vel) * dt;
        s.y += s.vel * dt;
        if (Math.abs(s.y) < 0.3 && Math.abs(s.vel) < 4) {
          s.y = 0;
          s.phase = "idle";
        }
      } else if (s.phase === "auto") {
        s.y += 320 * dt;
        if (inSlot(s.y) >= GRAB) startFeed();
      } else if (s.phase === "feed" || s.phase === "drag") {
        if (s.phase === "feed") s.y += feedSpeed * dt;
        if (s.motorOn) {
          jitter = (Math.random() - 0.5) * 1.2;
          motor.current?.chew();
        }
        if (s.y >= total) {
          s.y = total;
          s.phase = "gone";
          s.goneAt = s.clock;
          scene.current?.release(s.batch);
          s.pending = false;
          motorRef.current(false);
          setAnnounce("Document shredded");
          live.current.onShred?.();
        }
      } else if (s.phase === "gone") {
        if (s.clock - s.goneAt > 0.9) {
          s.phase = "enter";
          s.y = -20;
          s.opacity = 0;
        }
      } else if (s.phase === "enter") {
        const k = 1 - Math.exp(-dt * 10);
        s.y += (0 - s.y) * k;
        s.opacity += (1 - s.opacity) * k;
        if (-s.y < 0.3) {
          s.y = 0;
          s.opacity = 1;
          s.phase = "idle";
        }
      } else if (s.phase === "idle") {
        busy = false;
      }

      if (still && s.phase === "feed") s.opacity = Math.max(0, 1 - s.y / total);
      placeCard(jitter);
      // the sheet's top edge in machine px, which is where the strips ride
      if (s.pending) scene.current?.feed(s.batch, s.y - PAPER_GAP - ph);
      const moving = scene.current?.step(dt) ?? false;

      if (busy || moving) frame = requestAnimationFrame(tick);
      else frame = 0;
    };

    const startFeed = () => {
      s.phase = "feed";
      motorRef.current(true);
    };

    loop.current = () => {
      if (frame) return;
      frame = requestAnimationFrame((now) => {
        last = now;
        tick(now);
      });
    };

    return () => {
      cancelAnimationFrame(frame);
      frame = 0;
      motor.current?.close();
      motor.current = null;
      scene.current?.dispose();
      scene.current = null;
    };
    // The loop reads everything else through refs. The scene doesn't depend on
    // the sheet (each batch of strips is sized to its own sheet), so a taller
    // document never throws away the pile in the bin.
  }, [stage_w, COUNT]);

  // Paint the sheet ahead of the grab, so the strips have their texture by the
  // time they come out. Dropped on every render, since the content may differ.
  const warm = () => {
    const el = paperRef.current;
    if (!warmed.current && el && !reduce) warmed.current = rasterize(el, paper_w);
  };
  useEffect(() => {
    warmed.current = null;
  });

  // A fresh set of strips for the sheet about to go in, textured from it.
  // (A set that never went through is dropped by the scene.)
  const ensureBatch = () => {
    const s = sim.current;
    const el = paperRef.current;
    if (reduce || !scene.current || !el) return;
    warm();
    const paint = warmed.current as Promise<HTMLCanvasElement>;
    warmed.current = null;
    s.batch += 1;
    s.pending = true;
    scene.current.begin(s.batch, paint, paperColor(el), s.y - PAPER_GAP - paper_h, { x: card_x, w: paper_w, h: paper_h });
  };

  useEffect(() => {
    if (!sound) motor.current?.set(false);
  }, [sound]);

  const ensureMotor = () => {
    if (!motor.current && sound) motor.current = createMotor();
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const s = sim.current;
    if (s.phase !== "idle" && s.phase !== "settle") return;
    ensureMotor();
    e.currentTarget.setPointerCapture(e.pointerId);
    ensureBatch();
    s.phase = "drag";
    s.vel = 0;
    s.grabY = e.clientY;
    s.grabFrom = s.y;
    loop.current();
  };

  // The sheet follows the pointer exactly, into the slot as far as it's
  // pushed and no further. The motor runs while paper is in it.
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = sim.current;
    if (s.phase !== "drag") return;
    // Free above rest, a little resistance upward, straight down into the slot.
    const dy = e.clientY - s.grabY;
    let y = Math.max(-TOP_ROOM, s.grabFrom + (dy < 0 ? dy * 0.3 : dy));
    // Once strips are coming out the blades have it: further in, never back out.
    if (inSlot(s.y) > BITE) y = Math.max(y, s.y);
    s.y = Math.min(y, travel);
    setMotor(inSlot(s.y) > 0);
    loop.current();
  };

  // Let go with strips already out and the motor pulls the rest through;
  // let go before that and the sheet slides back out.
  const onPointerUp = () => {
    const s = sim.current;
    if (s.phase !== "drag") return;
    if (inSlot(s.y) > BITE) {
      s.phase = "feed";
      setMotor(true);
    } else {
      s.phase = "settle";
      setMotor(false);
    }
    loop.current();
  };

  const shred = () => {
    const s = sim.current;
    if (s.phase !== "idle") return;
    ensureMotor();
    ensureBatch();
    s.phase = "auto";
    loop.current();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " " || e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      shred();
    }
  };

  return (
    <div className={cn("relative mx-auto select-none", className)} style={{ width: stage_w, height: root_h, maxWidth: "100%" }}>
      <style>{`
        @keyframes ps-blink { 0%, 55% { opacity: 1 } 56%, 100% { opacity: 0 } }
        .ps-blink { animation: ps-blink 1.1s steps(1, end) infinite }
        @media (prefers-reduced-motion: reduce) { .ps-blink { animation: none } }
      `}</style>

      {/* The machine: a fixed-size block pinned to the bottom, so the sheet can be any height above it. */}
      <div className="absolute inset-x-0 bottom-0" style={{ height: MACHINE_H }}>
        {/* Bin, behind the strips: its back wall. */}
        {/* .edge-inner sets position: relative, so it sits inside the positioned box. */}
        {/* isolate keeps its edge (drawn at z-index 1) from showing through the body. */}
        <div aria-hidden className="absolute isolate" style={{ left: BIN_INSET, right: BIN_INSET, top: BIN_Y - 8, bottom: 0 }}>
          <div className="edge-inner size-full rounded-b-[28px] rounded-t-md bg-foreground/[0.03]" />
        </div>

        {/* Strips, under the body so they come out of its bottom edge. */}
        <canvas
          ref={canvasRef}
          aria-hidden
          className="pointer-events-none absolute left-0"
          style={{ top: CANVAS_Y, width: stage_w, height: MACHINE_H - CANVAS_Y }}
        />

        {/* Bin, in front of the strips: the clear plastic, with its reflections. */}
        <div
          aria-hidden
          className="pointer-events-none absolute isolate overflow-hidden rounded-b-[28px] rounded-t-md"
          style={{
            left: BIN_INSET,
            right: BIN_INSET,
            top: BIN_Y - 8,
            bottom: 0,
            boxShadow:
              "inset 0 1px 0 rgb(255 255 255 / 0.55), inset 1px 0 0 rgb(255 255 255 / 0.3), inset -1px 0 0 rgb(255 255 255 / 0.12), inset 0 -1px 0 rgb(0 0 0 / 0.06), inset 0 0 22px rgb(255 255 255 / 0.07)",
          }}
        >
          {/* a faint cool tint, as in any clear plastic */}
          <span className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgb(150 190 255 / 0.06), rgb(150 190 255 / 0.02))" }} />
          {/* the window's reflection: one wide band, one thin, and a dark band opposite */}
          <span
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(110deg, transparent 14%, rgb(255 255 255 / 0.2) 19%, rgb(255 255 255 / 0.07) 31%, transparent 35%, transparent 40%, rgb(255 255 255 / 0.16) 42%, transparent 45%, transparent 78%, rgb(0 0 0 / 0.035) 90%, transparent 100%)",
            }}
          />
          {/* light from above, on the rim */}
          <span className="absolute inset-x-0 top-0 h-10" style={{ background: "linear-gradient(180deg, rgb(255 255 255 / 0.3), transparent)" }} />
          {/* the thick lower lip catches light too */}
          <span className="absolute inset-x-6 bottom-[3px] h-px rounded-full" style={{ background: "linear-gradient(90deg, transparent, rgb(255 255 255 / 0.45), transparent)" }} />
        </div>

        {/* Shredder body with the slot along its top. */}
        <div
          ref={bodyRef}
          aria-hidden
          className="edge-outer absolute rounded-[22px] bg-muted"
          style={{ left: BODY_INSET, right: BODY_INSET, top: 0, height: BODY_H }}
        >
          {/* Plastic: a gloss from the top, bevelled edges, a moulded grain. Over the
              body's own colour and edge, under the slot and the controls. */}
          <div
            className="pointer-events-none absolute inset-0 rounded-[inherit] dark:opacity-60"
            style={{
              background:
                "linear-gradient(180deg, rgb(255 255 255 / 0.5) 0%, rgb(255 255 255 / 0.14) 20%, rgb(255 255 255 / 0) 46%, rgb(0 0 0 / 0.07) 100%)",
              boxShadow:
                "inset 0 1.5px 0 rgb(255 255 255 / 0.75), inset 0 -2px 3px rgb(0 0 0 / 0.14), inset 1.5px 0 1px -1px rgb(255 255 255 / 0.5), inset -1.5px 0 1px -1px rgb(0 0 0 / 0.1), 0 10px 18px -10px rgb(0 0 0 / 0.35)",
            }}
          />
          {/* a soft highlight sweeping across the shoulder */}
          <div
            className="pointer-events-none absolute inset-0 rounded-[inherit] dark:opacity-50"
            style={{ background: "linear-gradient(104deg, transparent 8%, rgb(255 255 255 / 0.22) 17%, transparent 30%)" }}
          />
          <div
            className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.22] mix-blend-multiply"
            style={{ backgroundImage: GRAIN, backgroundSize: "140px 140px" }}
          />

          {/* The slot is as wide as the bin below it. */}
          <div
            className="absolute h-[6px] rounded-full bg-zinc-900 dark:bg-black"
            style={{
              left: BIN_INSET - BODY_INSET,
              right: BIN_INSET - BODY_INSET,
              top: SLOT_Y - 3,
              boxShadow: "inset 0 1px 3px rgb(0 0 0 / 0.85), 0 1px 0 rgb(255 255 255 / 0.55), 0 -0.5px 0 rgb(0 0 0 / 0.2)",
            }}
          />
          <div className="absolute inset-x-0 bottom-3 flex items-center justify-between px-4">
            <Lcd text={running ? "Shredding…" : "Drag a file in"} cursor={!running} />
            <Led on={running} />
          </div>
        </div>
      </div>

      {/* The document, cut off at the slot. */}
      <div className="absolute inset-x-0 top-0 overflow-hidden" style={{ height: layer_h }}>
        <div
          ref={cardRef}
          role="button"
          tabIndex={0}
          aria-label="Shred document"
          onPointerEnter={warm}
          onFocus={warm}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          className="absolute top-0 cursor-grab touch-none rounded-lg outline-none will-change-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400 active:cursor-grabbing dark:focus-visible:outline-zinc-500"
          style={{
            left: card_x,
            width: paper_w,
            height: paper_h,
            transform: `translate3d(0, ${TOP_ROOM}px, 0)`,
            // not shown until measured, so it never flashes at the wrong size
            visibility: natural ? "visible" : "hidden",
          }}
        >
          {/* The node at its natural size, scaled from the corner. Pointer events are off
              so the whole sheet is one drag handle whatever is on it. */}
          <div
            className="pointer-events-none absolute left-0 top-0"
            style={{ width: "max-content", transform: `scale(${scale})`, transformOrigin: "0 0" }}
          >
            <div ref={paperRef} style={{ width: "max-content" }}>
              {children ?? <SamplePaper />}
            </div>
          </div>
        </div>
      </div>

      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
    </div>
  );
}
