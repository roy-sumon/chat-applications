"use client";

import React, { useState } from "react";
import Image from "next/image";
import { cn, getInitials } from "@/lib/utils";

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  isOnline?: boolean;
  showOnlineStatus?: boolean;
  className?: string;
}

const sizeClasses = {
  xs: "w-6 h-6 text-xs",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
  xl: "w-16 h-16 text-lg",
  "2xl": "w-20 h-20 text-xl",
};

const badgeSizeClasses = {
  xs: "w-2 h-2 ring-1",
  sm: "w-2.5 h-2.5 ring-2",
  md: "w-3 h-3 ring-2",
  lg: "w-3.5 h-3.5 ring-2",
  xl: "w-4 h-4 ring-2",
  "2xl": "w-5 h-5 ring-3",
};

// Distinct deterministic color gradient generator for initials
function getInitialsGradient(name: string) {
  const gradients = [
    "from-indigo-600 to-violet-600",
    "from-cyan-600 to-blue-600",
    "from-emerald-600 to-teal-600",
    "from-amber-600 to-orange-600",
    "from-rose-600 to-pink-600",
    "from-fuchsia-600 to-purple-600",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}

export function Avatar({
  src,
  name = "User",
  size = "md",
  isOnline = false,
  showOnlineStatus = false,
  className,
}: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const initials = getInitials(name || "User");
  const gradient = getInitialsGradient(name || "User");

  return (
    <div className={cn("relative shrink-0 select-none", sizeClasses[size], className)}>
      <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center font-semibold text-white shadow-sm ring-1 ring-slate-800/10 dark:ring-white/10">
        {src && !imgError ? (
          <Image
            src={src}
            alt={name || "Avatar"}
            width={80}
            height={80}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
            unoptimized={src.startsWith("http://") || src.startsWith("https://")}
          />
        ) : (
          <div
            className={cn(
              "w-full h-full flex items-center justify-center bg-gradient-to-br tracking-wider uppercase font-medium",
              gradient
            )}
          >
            {initials}
          </div>
        )}
      </div>

      {showOnlineStatus && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full ring-slate-900",
            badgeSizeClasses[size],
            isOnline ? "bg-emerald-500 ring-white dark:ring-slate-900" : "bg-slate-500 ring-white dark:ring-slate-900"
          )}
          title={isOnline ? "Online" : "Offline"}
        />
      )}
    </div>
  );
}
