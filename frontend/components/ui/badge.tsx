import React from "react";
import { cn } from "./utils";

export type BadgeVariant = "default" | "success" | "warning" | "info" | "danger";

interface BadgeProps {
  variant?: BadgeVariant;
  className?: string;
  children: React.ReactNode;
}

export const Badge = ({ variant = "default", className, children }: BadgeProps) => {
  const styles: Record<BadgeVariant, string> = {
    default: "bg-gray-100 text-gray-800 border-gray-200",
    success: "bg-green-50 text-green-700 border-green-200",
    warning: "bg-yellow-50 text-yellow-800 border-yellow-200",
    info: "bg-blue-50 text-blue-700 border-blue-200",
    danger: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        styles[variant],
        className
      )}
    >
      {children}
    </span>
  );
};
