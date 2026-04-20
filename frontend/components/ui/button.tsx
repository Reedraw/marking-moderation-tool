import React from "react";
// Import the class name utility for merging Tailwind classes
import { cn } from "./utils";

// Union type for button style variants
export type ButtonVariant = "default" | "outline" | "ghost" | "destructive";

// Props interface extending native HTML button attributes
// This means our Button inherits all standard button props (onClick, disabled, type, etc.)
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;    // Visual style variant, defaults to "default"
  className?: string;         // Additional custom Tailwind classes
}

// Reusable Button component with variant-based styling
// ...props uses the spread operator to pass all remaining props (onClick, disabled, etc.) to the native button
export const Button = ({ variant = "default", className, ...props }: ButtonProps) => {
  // Base styles shared across all variants - flexbox layout, rounded corners, padding, transition
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition border";
  // Variant-specific styles for background, text colour, border, and hover effects
  const styles: Record<ButtonVariant, string> = {
    default: "bg-black text-white border-black hover:opacity-90",              // Primary black button
    outline: "bg-white text-black border-gray-300 hover:bg-gray-50",           // Secondary outlined button
    ghost: "bg-transparent text-black border-transparent hover:bg-gray-100",    // Minimal/invisible button
    destructive: "bg-red-600 text-white border-red-600 hover:opacity-90",      // Red delete/danger button
  };
  // Render native button element with merged base + variant + custom classes
  return <button className={cn(base, styles[variant], className)} {...props} />;
};
