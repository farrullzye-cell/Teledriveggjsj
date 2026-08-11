import type { Metadata } from 'next';
import { Playfair_Display, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'RULLZYE CLOUD — Telegram Cloud Storage',
  description: 'Penyimpanan file sederhana & elegan dengan Telegram sebagai storage dan Excel sebagai database metadata.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${jakarta.variable}`}>
      <body className="font-sans bg-[#080808] text-[#e5e5e5] antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

