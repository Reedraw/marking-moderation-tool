// Home page component - the root route ("/") of the application
// This is a Server Component by default (no "use client" directive needed)

// Import the redirect function from Next.js navigation module
// redirect() performs a server-side redirect, sending an HTTP 307 response to the browser
import { redirect } from "next/navigation";

// Default export defines the page component for the "/" route in Next.js App Router
// When a user visits the root URL, this function executes on the server
export default function Home() {
  // Immediately redirect users from the home page to the login page
  // This ensures unauthenticated users always land on the login screen first
  // redirect() throws a special Next.js error internally to halt rendering and trigger the redirect
  redirect("/login");
}
