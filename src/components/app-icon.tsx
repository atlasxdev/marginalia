import { BookOpenTextIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppIcon({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "grid place-items-center rounded-[22.5%] bg-linear-to-b from-[#3d9bff] to-[#0062e0] text-white shadow-sm",
        className
      )}
    >
      <BookOpenTextIcon className="size-1/2" strokeWidth={1.75} />
    </div>
  );
}
