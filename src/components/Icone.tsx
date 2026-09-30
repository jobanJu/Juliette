// Jeu d'icônes unique de Juliette : pictogrammes au trait, de la couleur du texte.
// Les catalogues (modules, outils, HACCP…) stockent le nom ; ce composant le dessine.
import {
  AlertTriangle, Ban, Bean, Beef, BookOpen, Boxes, Building2, CalendarCheck, CalendarDays, CalendarRange, Camera, ChefHat,
  Clock, ClipboardCheck, ClipboardList, CloudSun, Construction, Egg, Euro, Eye, ExternalLink, FileSignature, FileText,
  Files, Fish, Flame, FlaskConical, FolderArchive, FolderOpen, GraduationCap, Handshake, HelpCircle, Image, Inbox, KeyRound,
  Landmark, LayoutDashboard, Leaf, Lightbulb, Lock, LogOut, Mail, Menu, MessageSquare, Mic, Milk, Monitor, Moon, Nut,
  PackageCheck, Paperclip, PartyPopper, PenLine, Phone, Pin, Printer, Receipt, Refrigerator, Salad, ScrollText, Search,
  Settings, Shell, Shield, ShieldCheck, ShoppingBag, ShoppingBasket, Shrimp, Smartphone, Snowflake, Sparkles, SprayCan,
  Store, Sunrise, Tent, ThumbsUp, Thermometer, Trash2, TrendingDown, TrendingUp, Truck, Upload, Users, UtensilsCrossed,
  Wand2, Wheat, Wine, Wrench, Zap, Bike, BarChart3, Flower2, Palmtree, CreditCard, Carrot, Droplets, Tag,
  LogIn, Pause, Play, RefreshCw, ThermometerSnowflake, Trophy, Pencil, Copy, Signature, ImageOff,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICONES = {
  alerte: AlertTriangle, interdit: Ban, legumineuse: Bean, viande: Beef, livre: BookOpen, stock: Boxes, immeuble: Building2,
  reservation: CalendarCheck, calendrier: CalendarDays, planning: CalendarRange, photo: Camera, cuisine: ChefHat, horloge: Clock,
  controle: ClipboardCheck, liste: ClipboardList, meteo: CloudSun, travaux: Construction, oeuf: Egg, euro: Euro, voir: Eye,
  lien: ExternalLink, contrat: FileSignature, document: FileText, documents: Files, poisson: Fish, cuisson: Flame,
  analyse: FlaskConical, archives: FolderArchive, dossier: FolderOpen, formation: GraduationCap, partenaire: Handshake,
  aide: HelpCircle, image: Image, reception: Inbox, cle: KeyRound, institution: Landmark, tableau: LayoutDashboard,
  vegetal: Leaf, astuce: Lightbulb, cadenas: Lock, deconnexion: LogOut, mail: Mail, menu: Menu, message: MessageSquare,
  micro: Mic, lait: Milk, ecran: Monitor, soir: Moon, fruits_coque: Nut, livraison_ok: PackageCheck, piece_jointe: Paperclip,
  fete: PartyPopper, rh: PenLine, telephone: Phone, epingle: Pin, imprimer: Printer, facture: Receipt, frigo: Refrigerator,
  salade: Salad, parchemin: ScrollText, recherche: Search, reglages: Settings, mollusque: Shell, bouclier: Shield,
  hygiene: ShieldCheck, emporter: ShoppingBag, marche: ShoppingBasket, crustace: Shrimp, mobile: Smartphone,
  surgele: Snowflake, evenement: Sparkles, nettoyage: SprayCan, boutique: Store, matin: Sunrise, festival: Tent,
  bravo: ThumbsUp, temperature: Thermometer, supprimer: Trash2, baisse: TrendingDown, hausse: TrendingUp, camion: Truck,
  envoyer: Upload, equipe: Users, salle: UtensilsCrossed, magie: Wand2, ble: Wheat, vin: Wine, outils: Wrench,
  eclair: Zap, livraison: Bike, graphique: BarChart3, fleur: Flower2, vacances: Palmtree, paiement: CreditCard,
  legume: Carrot, huile: Droplets, etiquette: Tag,
  arrivee: LogIn, pause: Pause, reprise: Play, renouveler: RefreshCw, decongele: ThermometerSnowflake, trophee: Trophy,
  modifier: Pencil, copier: Copy, signer: Signature, sans_image: ImageOff,
} satisfies Record<string, LucideIcon>;

export type NomIcone = keyof typeof ICONES;

export default function Icone({ nom, taille = 16, className }: { nom: NomIcone; taille?: number; className?: string }) {
  const Dessin = ICONES[nom];
  return <Dessin size={taille} strokeWidth={1.75} className={`icone${className ? ` ${className}` : ""}`} aria-hidden />;
}
