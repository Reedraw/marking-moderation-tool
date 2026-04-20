// Root layout component - wraps every page in the entire application
// This is the top-level layout in Next.js App Router; all routes inherit from this

// Import the Metadata type from Next.js for defining page metadata (title, description, etc.)
import type { Metadata } from "next";
// Import the global CSS file which contains Tailwind CSS directives for styling the entire app
import "./globals.css";

// Export a metadata object that Next.js uses to set the <title> and <meta> tags in the HTML <head>
// This improves SEO and sets the browser tab title for every page in the application
export const metadata: Metadata = {
  title: "Marking Moderation Tool",
  description: "Marking Moderation Tool for Final Year Uni Project",
};

// Default export makes this the root layout - Next.js requires this in app/layout.tsx
// The 'children' prop represents whatever page or nested layout is currently being rendered
// Readonly<> ensures the props object cannot be mutated, enforcing immutability
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode; // React.ReactNode allows any valid React content (JSX, strings, arrays, etc.)
}>) {
  return (
    // The <html> element with lang="en" sets the document language for accessibility and SEO
    <html lang="en">
      {/* The <body> element wraps all visible page content */}
      <body
      >
        {/* Render the current page content - this is where nested layouts and pages are injected */}
        {children}
      </body>
    </html>
  );
} 
