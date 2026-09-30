import type { Metadata, Viewport } from "next";
import { Fraunces } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/lib/session";

// Police du nom « Juliette » dans le logo.
const fraunces = Fraunces({ subsets: ["latin"], style: ["italic"], weight: ["500"], variable: "--font-marque" });

export const metadata: Metadata = {
  title: "Juliette — Le quotidien du restaurant, enfin réuni",
  description: "La plateforme de pilotage des équipes, des stocks et des ventes du restaurant.",
};

// viewport-fit=cover : les marges de sécurité de l'iPhone (barre d'accueil, encoche) deviennent
// mesurables, pour que rien ne passe sous la barre du navigateur ou de l'écran.
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#fbfafc" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={fraunces.variable}>
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
