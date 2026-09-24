import React, { Suspense } from "react";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register - Pulse Chat",
  description: "Create an account on Pulse real-time chat.",
};

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="text-slate-400">Loading registration...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
