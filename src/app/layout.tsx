import type { Metadata } from 'next';
import './globals.css';
import './submissions.css';

export const metadata: Metadata = {
  title: 'Campus Ledger · CCS Finance',
  description: 'Transparent student fund collection and audit workspace.',
  icons: { icon: '/tmc-graduating-class.png', apple: '/apple-touch-icon.png' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
