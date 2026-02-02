import React from "react";
import { cn } from "./utils";

export const Card = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={cn("rounded-2xl border bg-white shadow-sm", className)}>{children}</div>
);

export const CardHeader = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={cn("p-4 border-b", className)}>{children}</div>
);

export const CardTitle = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={cn("text-base font-semibold", className)}>{children}</div>
);

export const CardDescription = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={cn("text-sm text-gray-600", className)}>{children}</div>
);

export const CardContent = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={cn("p-4", className)}>{children}</div>
);
