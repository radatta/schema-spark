"use client";

import { StickyHeader } from "@/components/layout/sticky-header";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Authenticated, Unauthenticated } from "convex/react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function Header() {
  return (
    <StickyHeader className="px-4 py-2">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold text-xl">
            Schema Spark
          </Link>
          <Link
            href="/spec"
            className="text-gray-600 hover:text-gray-900 text-sm"
          >
            Specification
          </Link>
        </div>
        <SignInAndSignUpButtons />
      </div>
    </StickyHeader>
  );
}

export function SignInAndSignUpButtons() {
  return (
    <div className="flex gap-4">
      <Authenticated>
        <UserButton afterSignOutUrl="#" />
      </Authenticated>
      <Unauthenticated>
        <SignInButton mode="modal">
          <Button variant="ghost">Sign in</Button>
        </SignInButton>
        <SignUpButton mode="modal">
          <Button>Sign up</Button>
        </SignUpButton>
      </Unauthenticated>
    </div>
  );
}
