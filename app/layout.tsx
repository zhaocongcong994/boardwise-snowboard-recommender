import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  return {
    title: "BOARDWISE｜滑雪单板推荐",
    description: "根据身体条件、技术能力、滑行偏好和预算，找到更适合你的滑雪单板。",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "BOARDWISE｜找到你的下一条线",
      description: "滑雪单板智能推荐",
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1734, height: 907, alt: "BOARDWISE 滑雪单板智能推荐" }],
    },
    twitter: { card: "summary_large_image", title: "BOARDWISE｜找到你的下一条线", description: "滑雪单板智能推荐", images: [`${origin}/og.png`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
