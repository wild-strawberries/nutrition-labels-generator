import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Food Label Generator',
  description: 'Calculate recipe nutrition from local CIQUAL data.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
