import type { Metadata } from "next";
import { WelcomeFlow } from "@/components/onboarding";

export const metadata: Metadata = { title: "Welcome" };

export default function WelcomePage() {
  return <WelcomeFlow />;
}
