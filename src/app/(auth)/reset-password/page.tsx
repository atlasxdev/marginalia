import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

// Reached from the reset email, which signs the user in first
export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
