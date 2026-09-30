import type { Metadata } from "next";
import { Fraunces } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/lib/session";

// Police du nom « Juliette » dans le logo.
const fraunces = Fraunces({ subsets: ["latin"], style: ["italic"], weight: ["500"], variable: "--font-marque" });

export const metadata: Metadata = {
  title: "Juliette — Le quotidien du restaurant, enfin réuni",
  description: "La plateforme de pilotage des équipes, des stocks et des ventes du restaurant.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={fraunces.variable}>
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
