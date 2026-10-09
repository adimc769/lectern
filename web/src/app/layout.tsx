import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '../components/AppShell';

export const metadata: Metadata = {
  title: 'Lectern — Offline Lecture Assistant',
  description: 'Private, student-first lecture study workstation powered 100% by local AI models.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('lectern_theme');if(t==='dark')document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-screen bg-[#FBFBF9] dark:bg-[#0B0F19] text-[#0F172A] dark:text-[#F8FAFC] antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
