import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Find Truth",
  description: "Telegram-бот поиска источников информации",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
