import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Marking Moderation Tool",
  description: "Marking Moderation Tool for Final Year Uni Project",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
      >
        {children}
      </body>
    </html>
  );
} 
