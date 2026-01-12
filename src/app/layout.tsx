import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Upload Tool - 自动化部署中心",
  description: "内部项目发布与部署管理系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
      </body>
    </html>
  );
}
