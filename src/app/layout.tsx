import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai, Sarabun } from "next/font/google";
import "./globals.css";

const sarabun = Sarabun({
  variable: "--font-sarabun",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-plex-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "สำรวจครุภัณฑ์ · ระบบบริหารงบประมาณโรงเรียน",
  description: "แบบสำรวจครุภัณฑ์รายห้องสำหรับครู — เฟส 1 ของระบบบริหารงบประมาณโรงเรียน",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // ครูถ่ายรูปแล้วต้องซูมดูรายละเอียดป้ายเลขครุภัณฑ์ได้ จึงไม่ล็อก maximum-scale
  themeColor: "#0369a1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${sarabun.variable} ${plexThai.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
