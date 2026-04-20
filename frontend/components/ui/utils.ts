// Utility function for conditionally joining CSS class names together
// Accepts strings, undefined, false, or null - filters out falsy values
// Used across all UI components to merge base styles with custom className props
// Example: cn("base-class", isActive && "active", className) => "base-class active custom"
export function cn(...classes: (string | undefined | false | null)[]): string {
  // Filter out falsy values (undefined, false, null) and join remaining class strings with spaces
  return classes.filter(Boolean).join(" ");
}
