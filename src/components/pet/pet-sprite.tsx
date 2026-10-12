import { ART, INK, palette, type PetLook } from "@/lib/pet-art";
import { cn } from "@/lib/utils";

/** What the face is doing. */
export type Face = "open" | "closed" | "happy" | "side" | "chomp" | "flat";

const RED = "#df2224";
const FRAME = "#1f2937";

/**
 * The pet drawn in art pixels: body, eyes, mouth and accessory, plus a little
 * book to hold while it reads. Sized by className; crisp at any whole scale.
 */
export function PetSprite({
  look,
  face = "open",
  book = false,
  className,
}: {
  look: PetLook;
  face?: Face;
  /** Holding an open book (it's reading an answer). */
  book?: boolean;
  className?: string;
}) {
  const art = ART[look.species];
  const colors = palette(look.color);
  const [e1, e2] = art.eyes;
  const ey = art.eyeY;
  const px = (x: number, y: number, w = 1, h = 1, fill = INK, key?: string) => (
    <rect key={key ?? `${x}-${y}-${w}-${h}-${fill}`} x={x} y={y} width={w} height={h} fill={fill} />
  );

  const eye = (x: number) => {
    if (face === "closed") return px(x, ey + 1, 2, 1);
    if (face === "happy") return [px(x, ey + 1, 1, 1, INK, `${x}a`), px(x + 1, ey, 1, 1, INK, `${x}b`)];
    if (face === "side") return px(x + 1, ey, 1, 2);
    if (look.eyes === "sleepy") return [px(x, ey, 2, 1, colors.O, `${x}l`), px(x, ey + 1, 2, 1, INK, `${x}e`)];
    if (look.eyes === "sparkle") return [px(x, ey, 2, 2, INK, `${x}e`), px(x, ey, 1, 1, "#ffffff", `${x}s`)];
    return px(x, ey, 2, 2);
  };

  const [mx, my] = art.mouth;
  const mouth =
    face === "chomp" ? px(mx, my, 2, 2) : face === "happy" ? [px(mx, my, 2, 1, INK, "m1"), px(mx - 1, my - 1, 1, 1, INK, "m2"), px(mx + 2, my - 1, 1, 1, INK, "m3")] : face === "flat" ? px(mx - 1, my, 4, 1) : px(mx, my, 2, 1, colors.O);

  const accessory = () => {
    switch (look.accessory) {
      case "glasses": {
        // A thin dark rim and bridge over the eyes; the lenses are drawn underneath
        const rim = (x: number) => px(x - 1, ey - 1, 4, 1, FRAME, `${x}rim`);
        const bridgeFrom = e1 + 3;
        const bridgeW = e2 - 1 - bridgeFrom;
        return [rim(e1), rim(e2), bridgeW > 0 ? px(bridgeFrom, ey - 1, bridgeW, 1, FRAME, "bridge") : null];
      }
      case "scarf": {
        const { y, from, to } = art.neck;
        return [px(from, y, to - from + 1, 1, RED, "band"), px(from + 1, y, 1, 1, "#ffffff55", "stripe"), px(to - 2, y + 1, 2, 2, RED, "tail")];
      }
      case "bookmark": {
        const [cx, cy] = art.crown;
        return [px(cx, cy - 2, 2, 3, RED, "ribbon"), px(cx, cy - 3, 1, 1, RED, "notch")];
      }
      default:
        return null;
    }
  };

  return (
    <svg viewBox="0 -3 16 17" shapeRendering="crispEdges" className={cn("block", className)} aria-hidden focusable="false">
      {art.rows.flatMap((row, y) =>
        [...row].map((ch, x) => (colors[ch] ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={colors[ch]} /> : null)),
      )}
      {look.accessory === "glasses" && [e1, e2].map((x) => px(x - 1, ey - 1, 4, 4, "#ffffffa0", `${x}lens`))}
      {eye(e1)}
      {eye(e2)}
      {mouth}
      {accessory()}
      {book && look.species !== "bookworm" && (
        <g>
          {px(4, 10, 8, 1, "#0152cb", "cover")}
          {px(4, 11, 8, 2, "#ffffff", "pages")}
          {px(7, 11, 2, 2, "#0152cb", "spine")}
          {px(4, 13, 8, 1, "#0152cb", "base")}
        </g>
      )}
    </svg>
  );
}
