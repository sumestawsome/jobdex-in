import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { AuthProvider } from "@/contexts/auth-context";
import { WorkspaceProvider } from "@/contexts/workspace-context";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JobDex.in",
  description:
    "Aplikasi manajemen job desk untuk Humas dan Media Kreatif organisasi mahasiswa.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" }
    ],
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <script
          id="jobdex-theme-init"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var storedTheme = localStorage.getItem('jobdex-theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var theme = storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : (prefersDark ? 'dark' : 'light');
                  document.documentElement.classList.toggle('dark', theme === 'dark');
                  
                  var storedColor = localStorage.getItem('jobdex-neo-color-theme');
                  document.documentElement.setAttribute('data-neo-color', storedColor || 'default');
                } catch (error) {}
              })();
            `,
          }}
        />
        <ThemeProvider>
          <AuthProvider>
            <WorkspaceProvider>
              {children}
              <Toaster position="top-right" richColors />
            </WorkspaceProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
