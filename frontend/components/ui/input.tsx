import React from "react";
// Import the class name utility for merging Tailwind classes
import { cn } from "./utils";

// Reusable Input component - wraps a native HTML input with consistent styling
// Accepts all standard input attributes (type, value, onChange, placeholder, etc.)
// Used in login, register, assessment creation, and marks upload forms
export const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    // Spread all native input props (type, value, onChange, placeholder, etc.)
    {...props}
    className={cn(
      // Base styles: full width, rounded corners, border, padding, focus ring
      "w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10",
      // Allow custom class overrides from parent
      props.className
    )}
  />
);
