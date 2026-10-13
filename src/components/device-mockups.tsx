"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** A MacBook Pro, drawn at 740×434. Pass the screen as children or src. */
export function MacbookMockUp({
  className,
  children,
  src,
}: Readonly<{
  className?: string;
  children?: React.ReactNode;
  src?: string;
}>) {
  return (
    <div className={cn("relative z-1 mx-0 my-4 max-h-[434px] w-[740px]", className)}>
      <div className="relative z-1 mx-auto my-0 h-[418px] w-[618px] overflow-hidden rounded-[20px] border-2 border-[rgb(200,202,203)] px-[9px] pt-[9px] pb-[23px] [background:rgb(13,13,13)]">
        {children || (
          <img
            alt="Macbook Pro background"
            className="relative h-[375px] w-full rounded-t-[10px] border-2 border-solid border-[rgb(18,18,18)] bg-cover object-cover"
            loading="lazy"
            src={src}
          />
        )}
        <div className="absolute right-0 bottom-0 left-0 h-6 bg-linear-to-b from-[#272727] to-[#0d0d0d]" />
      </div>

      <div className="absolute top-[11px] left-2/4 z-2 -ml-8 h-3 w-16 rounded-br rounded-bl bg-[rgb(13,13,13)]" />
      <div className="relative z-9 -mt-2.5 h-6 w-[740px] rounded-[2px_2px_12px_12px] border-[1px_2px_0px] border-solid border-[rgb(160,163,167)] shadow-[rgb(108,112,116)_0px_-2px_8px_0px_inset] [background:radial-gradient(circle,rgb(226,227,228)_85%,rgb(200,202,203)_100%)] [border-image:initial]">
        <div className="absolute top-0 left-1/2 ml-[-60px] h-2.5 w-[120px] rounded-b-[10px] shadow-[inset_0_0_4px_2px_#babdbf]" />
      </div>
      <div className="absolute -bottom-0.5 left-12 h-0.5 w-10 rounded-b-full bg-neutral-600" />
      <div className="absolute right-12 -bottom-0.5 h-0.5 w-10 rounded-b-full bg-neutral-600" />
    </div>
  );
}

/** An iPhone 14 Pro, drawn at 428×868. Pass the screen as children or src. */
export function Iphone14Pro({
  className,
  children,
  src,
}: Readonly<{
  className?: string;
  children?: React.ReactNode;
  src?: string;
}>) {
  return (
    <div className={cn("relative z-10 my-4 h-[868px] w-[428px]", className)}>
      <div className="relative z-30 h-[868px] w-[428px] rounded-[68px] border border-[#1B1721] bg-black p-[19px] shadow-[inset_0_0_4px_2px_rgb(192,183,205),inset_0_0_0_6px_rgb(52,44,63)]">
        <div className="absolute top-[85px] left-0 z-20 h-[7px] w-5 bg-black/25" />
        <div className="absolute top-[85px] right-0 z-20 h-[7px] w-5 bg-black/25" />
        <div className="absolute bottom-[85px] left-0 z-20 h-[7px] w-5 bg-black/25" />
        <div className="absolute right-0 bottom-[85px] z-20 h-[7px] w-5 bg-black/25" />
        <div className="absolute top-0 right-[85px] z-20 h-5 w-[7px] bg-black/25" />
        <div className="absolute bottom-0 left-[85px] z-20 h-5 w-[7px] bg-black/25" />
        <div className="relative z-20 block h-full w-full overflow-hidden rounded-[49px] bg-black">
          {children || <img alt="iPhone 14 Pro background" className="h-full w-full object-cover" src={src} />}
        </div>
      </div>

      <div className="absolute top-[29px] left-1/2 z-40 ml-[-60px] flex h-[35px] w-[120px] items-center justify-end rounded-[20px] bg-black pr-4">
        <div
          className="size-2.5 rounded-full"
          style={{
            background:
              "radial-gradient(farthest-corner at 20% 20%,#6074bf 0,transparent 40%),radial-gradient(farthest-corner at 80% 80%,#513785 0,#24555e 20%,transparent 50%)",
          }}
        />
      </div>
      <div className="absolute top-[115px] left-[-2px] h-[32px] w-[3px] rounded-[2px] bg-[#1B1721]" />
      <div className="absolute top-[200px] right-[-2px] h-[100px] w-[3px] rounded-[2px] bg-[#1B1721]" />
      <div className="absolute top-[180px] left-[-2px] h-[70px] w-[3px] rounded-[2px] bg-[#1B1721]" />
      <div className="absolute top-[270px] left-[-2px] h-[70px] w-[3px] rounded-[2px] bg-[#1B1721]" />
    </div>
  );
}

/**
 * Lays out fixed-size children on a width×height stage, then scales the whole
 * stage to the container's width, so pixel-drawn devices stay in proportion.
 */
export function FitStage({ width, height, className, children }: { width: number; height: number; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={ref} className={cn("relative w-full", className)} style={{ aspectRatio: `${width}/${height}` }}>
      <div
        className={cn("absolute top-0 left-0 origin-top-left", scale === null && "invisible")}
        style={{ width, height, transform: `scale(${scale ?? 1})` }}
      >
        {children}
      </div>
    </div>
  );
}
