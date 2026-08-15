import "./globals.css";

export const metadata = {
  title: "Movie Catalog — семейная коллекция",
  description: "Семейный каталог фильмов, сериалов, мультфильмов и документального кино.",
  applicationName: "Movie Catalog",
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    icon: "/film-reel.png",
    apple: "/film-reel.png",
  },
};

export const viewport = {
  themeColor: "#0b0b0d",
  colorScheme: "dark",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
