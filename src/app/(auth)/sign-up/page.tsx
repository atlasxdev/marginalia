import type { Metadata } from "next";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create an account", alternates: { canonical: "/sign-up" } };

export default function SignUpPage() {
  return <SignUpForm />;
}
