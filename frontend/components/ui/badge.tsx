import React from "react";
// Import the class name utility for merging Tailwind classes
import { cn } from "./utils";

// Union type for badge colour variants - used to display assessment statuses
export type BadgeVariant = "default" | "success" | "warning" | "info" | "danger";

// Props interface for the Badge component
interface BadgeProps {
  variant?: BadgeVariant;        // Colour variant, defaults to "default" (grey)
  className?: string;            // Additional custom Tailwind classes
  children: React.ReactNode;     // Text/content displayed inside the badge
}

// Badge component - renders a small coloured pill for status indicators
// Used across dashboards and detail views to show assessment status
export const Badge = ({ variant = "default", className, children }: BadgeProps) => {
  // Map each variant to its Tailwind background, text, and border colours
  const styles: Record<BadgeVariant, string> = {
    default: "bg-gray-100 text-gray-800 border-gray-200",      // Grey - neutral/draft
    success: "bg-green-50 text-green-700 border-green-200",    // Green - approved
    warning: "bg-yellow-50 text-yellow-800 border-yellow-200",  // Yellow - pending/escalated
    info: "bg-blue-50 text-blue-700 border-blue-200",          // Blue - in progress
    danger: "bg-red-50 text-red-700 border-red-200",           // Red - changes requested
  };
  return (
    // Render as an inline span with pill shape (rounded-full) and small text
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",  // Base pill styles
        styles[variant],   // Apply variant-specific colours
        className           // Allow custom class overrides
      )}
    >
      {children}
    </span>
  );
};
