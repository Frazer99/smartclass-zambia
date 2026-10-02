import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from '@/components/auth-provider';
import { Toaster } from '@/components/ui/sonner';
import { BackHome } from '@/components/back-home';

export const metadata: Metadata = {
  title: 'SmartClass Zambia — Your AI Teacher, Anytime, Anywhere',
  description:
    'AI-powered tutoring platform for Zambian Form 1–6 Mathematics, Science, Physics, and Chemistry, aligned to the Zambian Curriculum.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <AuthProvider>
          {children}
          <BackHome />
          <Toaster position="top-center" />
        </AuthProvider>
      </body>
    </html>
  );
}
