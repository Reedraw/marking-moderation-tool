import React from "react";
// Import the class name utility for merging Tailwind classes
import { cn } from "./utils";

// Card container component - provides a white rounded box with subtle shadow
// Used as the main content container across all dashboard and detail views
export const Card = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={cn("rounded-2xl border bg-white shadow-sm", className)}>{children}</div>
);

// Card header section - sits at the top of a Card with bottom border separator
export const CardHeader = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={cn("p-4 border-b", className)}>{children}</div>
);

// Card title - semibold text typically used inside CardHeader
export const CardTitle = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={cn("text-base font-semibold", className)}>{children}</div>
);

// Card description - smaller grey text for subtitles, used below CardTitle
export const CardDescription = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={cn("text-sm text-gray-600", className)}>{children}</div>
);

// Card content area - padded section for the main body content of a Card
export const CardContent = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={cn("p-4", className)}>{children}</div>
);
