import type { Metadata } from "next";
import { JetBrains_Mono, Schibsted_Grotesk, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const ui = Schibsted_Grotesk({ variable: "--font-ui", subsets: ["latin"] });
const read = Source_Serif_4({ variable: "--font-read", subsets: ["latin"] });
const code = JetBrains_Mono({ variable: "--font-code", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Marginalia", template: "%s · Marginalia" },
  description: "Ask questions about your documents and get answers with sources.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${ui.variable} ${read.variable} ${code.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
