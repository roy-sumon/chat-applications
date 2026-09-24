import React, { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In - Pulse Chat",
  description: "Sign in to your Pulse real-time chat account.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-slate-400">Loading sign-in...</div>}>
      <LoginForm />
    </Suspense>
  );
}
