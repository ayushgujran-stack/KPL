import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { AuctionProvider } from '@/context/AuctionContext';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Cricket Player Auction Management System | KPL 2026',
  description: 'Professional, secure, real-time cricket player auction system with live bidding, automatic random draw, budget tracking and reports.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#101827] text-white antialiased selection:bg-[#F5B942] selection:text-[#101827]">
        <AuthProvider>
          <AuctionProvider>
            <div className="flex flex-col min-h-screen">
              <Navbar />
              <main className="flex-1">
                {children}
              </main>
            </div>
          </AuctionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
