import React from "react";
import { cn } from "./utils";

export type ButtonVariant = "default" | "outline" | "ghost" | "destructive";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  className?: string;
}

export const Button = ({ variant = "default", className, ...props }: ButtonProps) => {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition border";
  const styles: Record<ButtonVariant, string> = {
    default: "bg-black text-white border-black hover:opacity-90",
    outline: "bg-white text-black border-gray-300 hover:bg-gray-50",
    ghost: "bg-transparent text-black border-transparent hover:bg-gray-100",
    destructive: "bg-red-600 text-white border-red-600 hover:opacity-90",
  };
  return <button className={cn(base, styles[variant], className)} {...props} />;
};
