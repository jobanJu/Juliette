import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Juliette — Le quotidien du restaurant, enfin réuni",
  description: "La plateforme de pilotage des équipes, des stocks et des ventes du restaurant.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}
