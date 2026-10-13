import Image from "next/image";
import { cn } from "@/lib/utils";
import { FitStage, Iphone14Pro, MacbookMockUp } from "./device-mockups";

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
    <FitStage width={1000} height={620}>
      <div className="relative size-full perspective-[2400px]">
        {/* Laptop */}
        <div className="absolute top-0 left-[10px] origin-left [transform:rotateY(9deg)_rotateX(4deg)_scale(1.2)] drop-shadow-[0_40px_50px_rgba(1,30,90,.3)]">
          <MacbookMockUp className="my-0">
            <div className="relative h-[375px] w-full overflow-hidden rounded-t-[10px] border-2 border-[rgb(18,18,18)]">
              <Screen name="laptop-session" alt="A Marginalia study session on a laptop" width={2160} height={1350} sizes="(min-width: 1152px) 900px, 90vw" />
            </div>
          </MacbookMockUp>
        </div>
        {/* Phone */}
        <div className="absolute right-[20px] bottom-0 h-[868px] w-[428px] origin-bottom-right [transform:rotateY(-12deg)_rotateX(4deg)_rotateZ(2deg)_scale(0.56)] drop-shadow-[0_50px_60px_rgba(1,30,90,.45)]">
          <Iphone14Pro className="my-0">
            <div className="h-full bg-[rgb(213,230,254)] pt-[54px] dark:bg-[rgb(19,52,112)]">
              <Screen name="phone-today" alt="Today in Marginalia on a phone" width={585} height={1266} sizes="(min-width: 1152px) 240px, 24vw" />
            </div>
          </Iphone14Pro>
        </div>
      </div>
    </FitStage>
  );
}
