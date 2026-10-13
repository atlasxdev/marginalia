"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

// Toasts are frosted glass pills, like the composer and the sidebar, with the
// icon in the theme's colour for each kind.
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-[18px] text-success" />,
        info: <InfoIcon className="size-[18px] text-primary" />,
        warning: <TriangleAlertIcon className="size-[18px] text-amber-500" />,
        error: <OctagonXIcon className="size-[18px] text-destructive" />,
        loading: <Loader2Icon className="size-[18px] animate-spin text-muted-foreground" />,
      }}
      gap={8}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "glass flex w-full items-center gap-3 rounded-2xl border border-glass-border bg-glass-strong py-3 pr-4 pl-3.5 font-sans text-sm text-foreground sm:w-(--width)",
          icon: "relative m-0 grid size-5 shrink-0 place-items-center",
          content: "flex min-w-0 flex-1 flex-col gap-0.5",
          title: "font-medium leading-snug wrap-anywhere",
          description: "text-muted-foreground leading-snug",
          actionButton: "raised ml-1 h-7 shrink-0 rounded-lg bg-primary px-2.5 text-xs font-medium text-primary-foreground",
          cancelButton: "ml-1 h-7 shrink-0 rounded-lg bg-muted px-2.5 text-xs font-medium",
          closeButton: "glass border border-glass-border bg-glass-strong text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
