import type { Metadata } from 'next';
import './globals.css';
import { AppProvider } from '@/context/AppContext';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';

export const metadata: Metadata = {
  title: 'ระบบทะเบียนทรัพย์สิน',
  description: 'ระบบจัดการและทะเบียนทรัพย์สินภาครัฐและองค์กร (Asset Management System)',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;600;700&family=Sarabun:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppProvider>
          <div className="app-container">
            <Sidebar />
            <div className="main-col">
              <Topbar />
              <main className="content">{children}</main>
            </div>
          </div>
        </AppProvider>
      </body>
    </html>
  );
}
