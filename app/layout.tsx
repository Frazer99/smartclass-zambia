import './globals.css';
import type { Metadata } from 'next';
import type { Viewport } from 'next';
import { AuthProvider } from '@/components/auth-provider';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: 'SmartClass Zambia — Your AI Teacher, Anytime, Anywhere',
  description:
    'AI-powered tutoring platform for Zambian Form 1–6 Mathematics, Science, Physics, and Chemistry, aligned to the Zambian Curriculum. Powered by ZedCode Technologies.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
          <Toaster position="top-center" />
        </AuthProvider>
      </body>
    </html>
  );
}
