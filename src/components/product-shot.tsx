import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Marginalia on devices, from /public/product: a light and a dark version,
 * swapped with the theme. Sizes are the files' own.
 */
const SHOTS = {
  devices: { width: 2400, height: 1460 },
  today: { width: 2400, height: 1460 },
} as const;

export function ProductShot({ name, alt, priority, className }: { name: keyof typeof SHOTS; alt: string; priority?: boolean; className?: string }) {
  const { width, height } = SHOTS[name];
  const sizes = "(min-width: 1152px) 1152px, 100vw";
  return (
    <div className={cn("relative", className)}>
      <Image src={`/product/${name}-light.webp`} alt={alt} width={width} height={height} sizes={sizes} priority={priority} className="h-auto w-full dark:hidden" />
      <Image src={`/product/${name}-dark.webp`} alt={alt} width={width} height={height} sizes={sizes} priority={priority} className="hidden h-auto w-full dark:block" />
    </div>
  );
}
