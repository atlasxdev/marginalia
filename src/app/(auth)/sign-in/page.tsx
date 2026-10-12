import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in", alternates: { canonical: "/sign-in" } };

// /auth/confirm sends people here with ?error=link when an email link has expired or was already used
async function SignInWithNotice({ searchParams }: Pick<PageProps<"/sign-in">, "searchParams">) {
  const { error } = await searchParams;
  return <SignInForm linkFailed={error === "link"} />;
}

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <Suspense fallback={<SignInForm />}>
      <SignInWithNotice searchParams={searchParams} />
    </Suspense>
  );
}
