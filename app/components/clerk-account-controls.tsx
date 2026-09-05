"use client";

import { SignInButton, SignUpButton, SignOutButton, Show, UserButton } from "@clerk/nextjs";

export default function ClerkAccountControls({ switchAccount = false }: { switchAccount?: boolean }) {
  if (switchAccount) return <SignOutButton redirectUrl="/sign-in"><button className="public-button public-button--outline-dark" type="button">Use another account</button></SignOutButton>;
  return <div className="lokd-account-controls">
    <Show when="signed-out">
      <SignInButton><button type="button" className="lokd-sign-in">Sign in</button></SignInButton>
      <SignUpButton><button type="button" className="lokd-sign-up">Create account</button></SignUpButton>
    </Show>
    <Show when="signed-in">
      <a className="lokd-sign-in" href="/account">My workspaces</a>
      <UserButton />
    </Show>
  </div>;
}
