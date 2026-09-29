import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from '@/components/auth-provider';
import { Toaster } from '@/components/ui/sonner';
import { ServiceWorkerRegistration } from '@/components/pwa/service-worker-registration';
import { OfflineBanner } from '@/components/pwa/offline-banner';

export const metadata: Metadata = {
  title: 'SmartClass Zambia — Your AI Teacher, Anytime, Anywhere',
  description:
    'AI-powered tutoring platform for Zambian Form 1–6 Mathematics, Science, Physics, and Chemistry, aligned to the Zambian Curriculum. Powered by ZedCode Technologies.',
  manifest: '/manifest.json',
  themeColor: '#0F2620',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>
        <ServiceWorkerRegistration />
        <OfflineBanner />
        <AuthProvider>
          {children}
          <Toaster position="top-center" />
        </AuthProvider>
      </body>
    </html>
  );
}
