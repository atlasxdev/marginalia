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

/** One screen, light and dark, swapped with the theme. */
function Screen({ name, alt, width, height, sizes }: { name: string; alt: string; width: number; height: number; sizes: string }) {
  return (
    <>
      <Image src={`/product/${name}-light.webp`} alt={alt} width={width} height={height} sizes={sizes} className="block h-auto w-full dark:hidden" />
      <Image src={`/product/${name}-dark.webp`} alt={alt} width={width} height={height} sizes={sizes} className="hidden h-auto w-full dark:block" />
    </>
  );
}

/**
 * A laptop and a phone, drawn around the app's real screens, each turned a
 * little the other way, like they're sitting on a desk.
 */
export function DeviceDuo() {
  return (
    <div className="relative aspect-[2400/1460] perspective-[2400px]">
      {/* Laptop */}
      <div className="absolute top-[2%] left-[2%] w-[84%] [transform:rotateY(9deg)_rotateX(4deg)] origin-left">
        <div className="relative rounded-t-[3%_5%] rounded-b-[0.6%] bg-[#0d0f14] px-[1.3%] pt-[1.3%] pb-[1.7%] shadow-[inset_0_0_0_2px_#2a2e37,0_40px_80px_-30px_rgba(1,30,90,.45)]">
          <span className="absolute top-[0.5%] left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-[#262a33]" />
          <div className="overflow-hidden rounded-[0.4%]">
            <Screen name="laptop-session" alt="A Marginalia study session on a laptop" width={2160} height={1350} sizes="(min-width: 1152px) 970px, 84vw" />
          </div>
        </div>
        <div className="relative -mx-[4.5%] h-[2.2%] min-h-2 rounded-t-sm rounded-b-[30px] bg-gradient-to-b from-[#e3e6ec] to-[#b9bec8] shadow-[0_30px_40px_-20px_rgba(1,30,90,.4)] before:absolute before:top-0 before:left-1/2 before:h-[40%] before:w-[15%] before:-translate-x-1/2 before:rounded-b-xl before:bg-[#a7adb8]" />
      </div>
      {/* Phone */}
      <div className="absolute right-[2%] bottom-[1%] w-[21%] [transform:rotateY(-12deg)_rotateX(4deg)_rotateZ(2deg)] origin-right">
        <div className="relative rounded-[16%/7.5%] bg-[#0d0f14] p-[3.4%] shadow-[inset_0_0_0_3px_#2f333c,0_50px_90px_-30px_rgba(1,30,90,.55)]">
          <div className="overflow-hidden rounded-[13%/6%] bg-[rgb(213,230,254)] pt-[11%] dark:bg-[rgb(19,52,112)]">
            <Screen name="phone-today" alt="Today in Marginalia on a phone" width={585} height={1266} sizes="(min-width: 1152px) 240px, 21vw" />
          </div>
          <span className="absolute top-[3.6%] left-1/2 h-[3%] w-[29%] -translate-x-1/2 rounded-full bg-black" />
        </div>
      </div>
    </div>
  );
}
