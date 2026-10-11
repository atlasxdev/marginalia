import { ArrowUpRightIcon } from "lucide-react";

/** "https://www.example.com/docs/start/" → "example.com/docs/start", shortened if long. */
export function prettyUrl(href: string) {
  try {
    const url = new URL(href);
    const path = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
    const text = url.hostname.replace(/^www\./, "") + path;
    return text.length > 42 ? text.slice(0, 40) + "…" : text;
  } catch {
    return href;
  }
}

/*
 * Links in answers and source passages. Web links open in a new tab with an
 * arrow, and a bare URL reads as its domain and path rather than the whole
 * address; the full address is in the tooltip.
 */
export function SmartLink({ href, children }: React.ComponentProps<"a">) {
  if (!href) return <>{children}</>;
  const web = /^https?:\/\//i.test(href);
  const bare = typeof children === "string" && (children === href || `mailto:${children}` === href);

  return (
    <a
      href={href}
      title={web ? href : undefined}
      {...(web ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="link"
    >
      {web && bare ? prettyUrl(href) : children}
      {web && (
        <>
          {/* A word joiner keeps the arrow on the same line as the text */}
          {String.fromCharCode(0x2060)}
          <ArrowUpRightIcon aria-hidden className="ml-0.5 inline size-[0.85em] align-[-0.05em]" />
          <span className="sr-only"> (opens in a new tab)</span>
        </>
      )}
    </a>
  );
}
