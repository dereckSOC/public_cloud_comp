import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: "Gamified Feedback",
  description: "A gamified feedback platform for event engagement by the Singapore Cancer Society",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
