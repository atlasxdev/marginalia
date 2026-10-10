import type { Metadata } from "next";
import { Bodoni_Moda, Caveat, Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import "./globals.css";

// Fallbacks for SF Pro and SF Mono on non-Apple devices
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const code = JetBrains_Mono({ variable: "--font-code", subsets: ["latin"] });
// Logo only: the serif wordmark and the handwritten margin note
const bodoni = Bodoni_Moda({ variable: "--font-bodoni", subsets: ["latin"], axes: ["opsz"] });
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Marginalia", template: "%s · Marginalia" },
  description: "Ask questions about your documents and get answers with sources.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("h-full", inter.variable, code.variable, bodoni.variable, caveat.variable)}>
      {/* Extensions like ColorZilla add attributes to <body> before React hydrates */}
      <body className="min-h-full" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
