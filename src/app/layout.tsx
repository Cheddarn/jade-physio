import type { Metadata, Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/ui";

export const metadata: Metadata = {
  title: "Jade Physio — Kasir & Jadwal",
  description: "Booking, checkout, voucher sesi, dan laporan penjualan Jade Physio",
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 28'%3E%3Ccircle cx='14' cy='14' r='12.5' fill='none' stroke='%2312805f' stroke-width='3'/%3E%3Ccircle cx='14' cy='14' r='5' fill='%231f9a73'/%3E%3C/svg%3E",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
