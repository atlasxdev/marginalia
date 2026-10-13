"use client";

import { useId, useMemo, useRef, useState } from "react";
import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { getStroke } from "perfect-freehand";
import { EraserIcon, HighlighterIcon, PenIcon, Trash2Icon, Undo2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { INK_HEIGHTS, INK_WIDTH, MARKER_COLORS, PEN_COLORS, type InkTool, type Stroke } from "@/lib/note";
import { cn } from "@/lib/utils";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    ink: { insertInk: () => ReturnType };
  }
}

const parseStrokes = (raw: string | null): Stroke[] => {
  try {
    const v = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

/** A block to write or draw in with a stylus, finger or mouse. In Markdown it's whatever text was read from it. */
export const Ink = Node.create({
  name: "ink",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      strokes: {
        default: [],
        parseHTML: (el) => parseStrokes(el.getAttribute("data-strokes")),
        renderHTML: (a) => ({ "data-strokes": JSON.stringify(a.strokes) }),
      },
      height: {
        default: INK_HEIGHTS.initial,
        parseHTML: (el) => Number(el.getAttribute("data-height")) || INK_HEIGHTS.initial,
        renderHTML: (a) => ({ "data-height": a.height }),
      },
      // What the handwriting says, and which strokes that was read from
      text: { default: "", parseHTML: (el) => el.getAttribute("data-text") ?? "", renderHTML: (a) => (a.text ? { "data-text": a.text } : {}) },
      textFor: { default: "", parseHTML: (el) => el.getAttribute("data-text-for") ?? "", renderHTML: (a) => (a.textFor ? { "data-text-for": a.textFor } : {}) },
    };
  },

  parseHTML: () => [{ tag: "div[data-ink]" }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-ink": "" })],
  renderMarkdown: (node) => String(node.attrs?.text ?? "").trim(),

  addCommands() {
    return {
      insertInk:
        () =>
        ({ commands }) =>
          commands.insertContent([{ type: this.name }, { type: "paragraph" }]),
    };
  },

  addNodeView() {
    // The block handles its own pointer events, so the editor leaves them alone
    return ReactNodeViewRenderer(InkView, { stopEvent: () => true, ignoreMutation: () => true });
  },
});

/* ---------- drawing ---------- */

const average = (a: number, b: number) => (a + b) / 2;

// perfect-freehand's outline, as a smooth closed path
function outlinePath(points: number[][]) {
  const len = points.length;
  if (len < 4) return "";
  let a = points[0];
  let b = points[1];
  const c = points[2];
  let d = `M${a[0].toFixed(1)},${a[1].toFixed(1)} Q${b[0].toFixed(1)},${b[1].toFixed(1)} ${average(b[0], c[0]).toFixed(1)},${average(b[1], c[1]).toFixed(1)} T`;
  for (let i = 2; i < len - 1; i++) {
    a = points[i];
    b = points[i + 1];
    d += `${average(a[0], b[0]).toFixed(1)},${average(a[1], b[1]).toFixed(1)} `;
  }
  return d + "Z";
}

const paths = new WeakMap<Stroke, string>();
export function strokePath(s: Stroke, done = true) {
  const cached = done ? paths.get(s) : undefined;
  if (cached !== undefined) return cached;
  const pts: number[][] = [];
  let pressured = false;
  for (let i = 0; i < s.points.length; i += 3) {
    pts.push([s.points[i], s.points[i + 1], s.points[i + 2]]);
    if (s.points[i + 2] !== 0.5) pressured = true;
  }
  const marker = s.tool === "marker";
  const d = outlinePath(
    getStroke(pts, {
      size: s.size,
      thinning: marker ? 0 : 0.6,
      smoothing: 0.5,
      streamline: 0.4,
      // A mouse or finger has no pressure, so speed thins the line instead
      simulatePressure: !pressured && !marker,
      last: done,
    })
  );
  if (done) paths.set(s, d);
  return d;
}

const SIZES: Record<InkTool, number> = { pen: 4.5, marker: 24 };
const round = (n: number) => Math.round(n * 10) / 10;

// Once a stylus has been used, a resting palm or finger doesn't draw
let penSeen = false;

type Mode = InkTool | "eraser";

function InkView({ node, updateAttributes, deleteNode, editor }: ReactNodeViewProps) {
  const strokes = node.attrs.strokes as Stroke[];
  const height = node.attrs.height as number;
  const editable = editor.isEditable;
  const [mode, setMode] = useState<Mode>("pen");
  const [colors, setColors] = useState<Record<InkTool, string>>({ pen: PEN_COLORS[0].value, marker: MARKER_COLORS[0].value });
  const [live, setLive] = useState<Stroke | null>(null);
  const [erased, setErased] = useState<ReadonlySet<Stroke>>(new Set());
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const active = useRef<{ id: number; stroke?: Stroke; erased?: Set<Stroke>; lowest: number } | null>(null);
  const grid = useId();
  const h = dragHeight ?? height;

  const toPoint = (e: PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    const k = INK_WIDTH / r.width;
    const pressure = e.pointerType === "pen" && e.pressure > 0 ? Math.round(e.pressure * 100) / 100 : 0.5;
    return [round((e.clientX - r.left) * k), round((e.clientY - r.top) * k), pressure];
  };

  const eraseAt = (x: number, y: number, hit: Set<Stroke>) => {
    for (const s of strokes) {
      if (hit.has(s)) continue;
      const reach = (12 + s.size / 2) ** 2;
      for (let i = 0; i < s.points.length; i += 3) {
        if ((s.points[i] - x) ** 2 + (s.points[i + 1] - y) ** 2 < reach) {
          hit.add(s);
          break;
        }
      }
    }
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!editable || active.current) return;
    if (e.pointerType === "pen") penSeen = true;
    else if (e.pointerType === "touch" && penSeen) return;
    // A stylus's eraser end, or its side button, rubs out
    const rubbing = mode === "eraser" || e.button === 5 || (e.buttons & 32) !== 0;
    if (!rubbing && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const [x, y, p] = toPoint(e.nativeEvent);
    if (rubbing) {
      const hit = new Set<Stroke>();
      eraseAt(x, y, hit);
      active.current = { id: e.pointerId, erased: hit, lowest: 0 };
      setErased(new Set(hit));
    } else {
      const tool = mode as InkTool;
      const stroke: Stroke = { tool, color: colors[tool], size: SIZES[tool], points: [x, y, p] };
      active.current = { id: e.pointerId, stroke, lowest: y };
      setLive({ ...stroke });
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const a = active.current;
    if (!a || a.id !== e.pointerId) return;
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const [x, y, p] = toPoint(ev);
      if (a.erased) eraseAt(x, y, a.erased);
      else if (a.stroke) {
        a.stroke.points.push(x, y, p);
        a.lowest = Math.max(a.lowest, y);
      }
    }
    if (a.erased) setErased(new Set(a.erased));
    else if (a.stroke) setLive({ ...a.stroke });
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const a = active.current;
    if (!a || a.id !== e.pointerId) return;
    active.current = null;
    if (a.erased) {
      if (a.erased.size) updateAttributes({ strokes: strokes.filter((s) => !a.erased!.has(s)) });
      setErased(new Set());
    } else if (a.stroke) {
      // Writing near the bottom makes room for the next line
      const grow = a.lowest > height - 60 ? Math.min(INK_HEIGHTS.max, height + 160) : height;
      updateAttributes({ strokes: [...strokes, a.stroke], height: grow });
      setLive(null);
    }
  };

  // Drag the bottom edge to make the space taller or shorter
  const onResizeDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const k = INK_WIDTH / svg.current!.getBoundingClientRect().width;
    const startY = e.clientY;
    const clamp = (y: number) => Math.round(Math.min(INK_HEIGHTS.max, Math.max(INK_HEIGHTS.min, height + (y - startY) * k)));
    const move = (ev: PointerEvent) => setDragHeight(clamp(ev.clientY));
    const up = (ev: PointerEvent) => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      setDragHeight(null);
      updateAttributes({ height: clamp(ev.clientY) });
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };

  // Highlighter strokes sit under the pen
  const ordered = useMemo(() => [...strokes.filter((s) => s.tool === "marker"), ...strokes.filter((s) => s.tool !== "marker")], [strokes]);
  const palette = mode === "marker" ? MARKER_COLORS : PEN_COLORS;

  return (
    <NodeViewWrapper className="ink my-5" data-ink="">
      <div className="overflow-hidden rounded-xl border border-border bg-background/70">
        {editable && (
          <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-1.5 py-1 [scrollbar-width:none]">
            <ToggleGroup type="single" size="sm" value={mode} onValueChange={(v) => v && setMode(v as Mode)} aria-label="Tool">
              <ToggleGroupItem value="pen" aria-label="Pen">
                <PenIcon />
              </ToggleGroupItem>
              <ToggleGroupItem value="marker" aria-label="Highlighter">
                <HighlighterIcon />
              </ToggleGroupItem>
              <ToggleGroupItem value="eraser" aria-label="Eraser">
                <EraserIcon />
              </ToggleGroupItem>
            </ToggleGroup>
            {mode !== "eraser" && (
              <div className="ml-0.5 flex shrink-0 items-center gap-0.5" role="radiogroup" aria-label="Color">
                {palette.map((c) => {
                  const on = colors[mode] === c.value;
                  return (
                    <button
                      key={c.name}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={c.name}
                      onClick={() => setColors((cs) => ({ ...cs, [mode]: c.value }))}
                      className={cn("grid size-6 shrink-0 place-items-center rounded-full transition-shadow", on && "ring-2 ring-ring/60")}
                    >
                      <span className="size-4 rounded-full ring-1 ring-foreground/15" style={{ background: c.value }} />
                    </button>
                  );
                })}
              </div>
            )}
            <div className="ml-auto flex shrink-0 items-center">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Undo last stroke"
                disabled={!strokes.length}
                onClick={() => updateAttributes({ strokes: strokes.slice(0, -1) })}
              >
                <Undo2Icon />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove drawing" onClick={() => deleteNode()}>
                <Trash2Icon />
              </Button>
            </div>
          </div>
        )}
        <svg
          ref={svg}
          viewBox={`0 0 ${INK_WIDTH} ${h}`}
          role="img"
          aria-label={node.attrs.text ? `Handwriting: ${node.attrs.text}` : "Handwriting"}
          className={cn("block w-full touch-none select-none", editable && (mode === "eraser" ? "cursor-cell" : "cursor-crosshair"))}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <defs>
            <pattern id={grid} width={32} height={32} patternUnits="userSpaceOnUse">
              <circle cx={16} cy={16} r={1.4} className="fill-foreground/15" />
            </pattern>
          </defs>
          <rect width={INK_WIDTH} height={h} fill={`url(#${grid})`} />
          {ordered.map((s, i) => (
            <path key={i} d={strokePath(s)} style={{ fill: s.color }} className={cn(erased.has(s) && "opacity-25")} />
          ))}
          {live && <path d={strokePath(live, false)} style={{ fill: live.color }} />}
        </svg>
        {editable && (
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="Drag to resize"
            onPointerDown={onResizeDown}
            className="flex h-4 cursor-ns-resize touch-none items-center justify-center border-t border-border"
          >
            <span className="h-1 w-10 rounded-full bg-foreground/15" />
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
