// Catégories de produits : famille (conservation / rayon) puis sous-catégorie.
// Le classement automatique lit le nom du produit (et l'indice de conservation s'il existe).
import type { NomIcone } from "@/components/Icone";

export type Famille = "frais" | "surgele" | "sec" | "boissons" | "non_alimentaire";

export const FAMILLES: Record<Famille, { label: string; icone: NomIcone; ton: string; sous: string[] }> = {
  frais: {
    label: "Frais",
    icone: "frigo",
    ton: "t-mint",
    sous: ["Fromages", "Crèmerie & œufs", "Viandes", "Volailles", "Charcuterie", "Poissons & fruits de mer", "Légumes", "Fruits", "Herbes fraîches", "Boulangerie", "Traiteur"],
  },
  surgele: {
    label: "Surgelé",
    icone: "surgele",
    ton: "t-blue",
    sous: ["Frites & pommes de terre", "Viandes & volailles", "Poissons & fruits de mer", "Légumes & fruits", "Pains & viennoiseries", "Glaces & desserts", "Plats préparés"],
  },
  sec: {
    label: "Épicerie sèche",
    icone: "ble",
    ton: "t-yellow",
    sous: ["Pâtes, riz & féculents", "Farines & sucres", "Conserves", "Huiles & vinaigres", "Condiments & sauces", "Épices", "Biscuits & snacks", "Petit-déjeuner"],
  },
  boissons: {
    label: "Boissons",
    icone: "vin",
    ton: "t-lav",
    sous: ["Eaux", "Softs & jus", "Bières", "Vins & champagnes", "Spiritueux", "Café & thé"],
  },
  non_alimentaire: {
    label: "Non alimentaire",
    icone: "nettoyage",
    ton: "t-peach",
    sous: ["Entretien & hygiène", "Emballages", "Petit matériel"],
  },
};

export const ORDRE_FAMILLES = Object.keys(FAMILLES) as Famille[];

const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Règles lues dans l'ordre : les plus précises d'abord (« pomme de terre » avant « pomme »).
const REGLES: [Famille, string, string[]][] = [
  ["non_alimentaire", "Entretien & hygiène", ["liquide vaisselle", "produit vaisselle", "detergent", "desinfectant", "degraissant", "javel", "eponge", "sac poubelle", "sacs poubelle", "savon", "gant", "essuie", "essuie-tout", "papier toilette", "lessive", "nettoyant", "rince", "lave-vaisselle", "tablette lave"]],
  ["non_alimentaire", "Emballages", ["barquette", "gobelet", "couvert", "couverts", "paille", "serviette", "film alimentaire", "papier aluminium", "papier cuisson", "sac kraft", "boite pizza", "boite burger", "emballage", "pot sauce", "couvercle", "sachet", "sac"]],
  ["boissons", "Eaux", ["eau", "evian", "vittel", "perrier", "san pellegrino", "badoit", "cristaline", "volvic", "chateldon"]],
  ["boissons", "Softs & jus", ["coca", "cola", "soda", "limonade", "jus", "nectar", "sirop", "orangina", "schweppes", "ice tea", "tonic", "fanta", "sprite", "oasis", "redbull", "red bull", "diabolo"]],
  ["boissons", "Bières", ["biere", "ipa", "leffe", "heineken", "1664", "fut", "pression", "affligem", "grimbergen", "desperados", "corona", "chouffe", "karmeliet", "cidre"]],
  ["boissons", "Spiritueux", ["rhum", "vodka", "gin", "whisky", "whiskey", "tequila", "cognac", "armagnac", "pastis", "ricard", "liqueur", "calvados", "cointreau", "aperol", "martini", "porto", "get 27", "baileys", "limoncello", "spritz"]],
  ["boissons", "Vins & champagnes", ["vin", "vins", "champagne", "cremant", "prosecco", "bordeaux", "bourgogne", "cotes du rhone", "muscadet", "chablis", "sancerre", "rose", "cava", "lambrusco"]],
  ["boissons", "Café & thé", ["cafe", "expresso", "espresso", "the", "infusion", "tisane", "chocolat chaud", "capsule"]],
  ["surgele", "Frites & pommes de terre", ["frite", "frites", "potatoes", "wedges", "pommes noisette", "rosti", "croquette"]],
  ["surgele", "Glaces & desserts", ["glace", "glaces", "sorbet", "creme glacee", "esquimau", "cone"]],
  ["sec", "Huiles & vinaigres", ["huile", "vinaigre", "balsamique"]],
  ["sec", "Conserves", ["conserve", "tomate pelee", "tomates pelees", "tomate concassee", "concentre de tomate", "pulpe", "coulis", "thon en boite", "mais", "haricots rouges", "pois chiches", "cornichon", "cornichons", "capres", "olive", "olives"]],
  ["sec", "Condiments & sauces", ["moutarde", "ketchup", "mayonnaise", "mayo", "sauce", "pesto", "tabasco", "sriracha", "vinaigrette", "bouillon", "fond de veau", "fumet"]],
  ["sec", "Épices", ["sel", "poivre", "epice", "epices", "paprika", "cumin", "curry", "cannelle", "muscade", "piment", "herbes de provence", "curcuma", "gingembre moulu", "safran", "origan"]],
  ["sec", "Farines & sucres", ["farine", "sucre", "cassonade", "levure", "chocolat", "cacao", "vanille", "maizena", "fecule", "poudre d'amande", "amande", "noisette", "pepites", "gelatine", "agar"]],
  ["sec", "Pâtes, riz & féculents", ["pates", "spaghetti", "penne", "tagliatelle", "fusilli", "linguine", "lasagne", "gnocchi", "riz", "risotto", "semoule", "quinoa", "lentille", "lentilles", "boulgour", "polenta", "nouilles", "vermicelle", "pois chiche"]],
  ["sec", "Biscuits & snacks", ["biscuit", "biscuits", "chips", "cacahuete", "cacahuetes", "crackers", "speculoos", "madeleine", "cookie", "cookies"]],
  ["sec", "Petit-déjeuner", ["cereales", "confiture", "miel", "pate a tartiner", "nutella", "muesli", "granola"]],
  ["frais", "Fromages", ["fromage", "emmental", "comte", "gruyere", "mozzarella", "mozza", "burrata", "parmesan", "parmigiano", "grana", "cheddar", "chevre", "feta", "ricotta", "mascarpone", "roquefort", "bleu", "camembert", "brie", "raclette", "reblochon", "maroilles", "gorgonzola", "pecorino", "tomme", "mimolette", "cantal", "halloumi", "boursin", "saint-nectaire", "morbier", "fourme"]],
  ["frais", "Crèmerie & œufs", ["lait", "creme", "beurre", "oeuf", "oeufs", "œuf", "yaourt", "yaourts", "fromage blanc", "faisselle", "skyr"]],
  ["frais", "Boulangerie", ["pain", "pains", "baguette", "brioche", "viennoiserie", "viennoiseries", "croissant", "croissants", "bun", "buns", "pate feuilletee", "pate brisee", "pate a pizza", "wrap", "wraps", "tortilla", "tortillas", "pita", "focaccia", "ciabatta"]],
  ["frais", "Charcuterie", ["jambon", "lardon", "lardons", "bacon", "saucisse", "saucisses", "chorizo", "salami", "coppa", "pancetta", "rillettes", "pate", "saucisson", "merguez", "andouillette", "boudin", "mortadelle", "bresaola", "speck", "guanciale"]],
  ["frais", "Volailles", ["poulet", "volaille", "dinde", "canard", "pintade", "magret", "caille", "chapon", "aiguillette", "aiguillettes"]],
  ["frais", "Viandes", ["boeuf", "bœuf", "veau", "porc", "agneau", "steak", "steaks", "entrecote", "bavette", "hache", "viande", "filet mignon", "cote", "joue", "paleron", "onglet", "rumsteck", "faux-filet", "basse cote", "tartare", "burger", "travers", "echine", "gigot", "souris"]],
  ["frais", "Poissons & fruits de mer", ["saumon", "cabillaud", "thon", "poisson", "crevette", "crevettes", "moule", "moules", "huitre", "huitres", "bar", "dorade", "lieu", "merlu", "colin", "calamar", "calamars", "encornet", "poulpe", "sardine", "anchois", "gambas", "saint-jacques", "noix de saint-jacques", "crabe", "homard", "truite", "maquereau", "haddock", "sole", "turbot", "lotte", "surimi", "tourteau"]],
  ["frais", "Herbes fraîches", ["basilic", "persil", "ciboulette", "coriandre", "menthe", "thym", "romarin", "aneth", "estragon", "cerfeuil", "sauge", "laurier"]],
  ["frais", "Légumes", ["pomme de terre", "pommes de terre", "patate", "patates", "tomate", "tomates", "salade", "laitue", "carotte", "carottes", "oignon", "oignons", "echalote", "echalotes", "ail", "poivron", "poivrons", "courgette", "courgettes", "aubergine", "aubergines", "champignon", "champignons", "poireau", "poireaux", "chou", "choux", "epinard", "epinards", "brocoli", "brocolis", "haricot vert", "haricots verts", "concombre", "radis", "betterave", "celeri", "navet", "potiron", "courge", "butternut", "roquette", "mache", "endive", "endives", "asperge", "asperges", "artichaut", "fenouil", "petits pois", "avocat", "avocats", "legume", "legumes", "gingembre", "citronnelle", "mesclun", "cebette", "oignon rouge", "patate douce", "mais"]],
  ["frais", "Fruits", ["pomme", "pommes", "poire", "poires", "banane", "bananes", "citron", "citrons", "citron vert", "orange", "oranges", "fraise", "fraises", "framboise", "framboises", "myrtille", "myrtilles", "mangue", "ananas", "kiwi", "raisin", "peche", "abricot", "melon", "pasteque", "cerise", "cerises", "pamplemousse", "fruit", "fruits", "clementine", "mandarine", "grenade", "figue", "passion", "litchi", "coco"]],
  ["frais", "Traiteur", ["quiche", "traiteur", "plat cuisine", "taboule", "houmous", "tzatziki", "guacamole", "tarte"]],
];

const MARQUEURS_SURGELE = ["surgele", "surgeles", "surgelee", "surgelees", "congele", "congelee", "congeles", "sg", "ssg", "iqf", "surg"];

// Un mot-clé correspond s'il apparaît comme mot entier (pluriel en s/x toléré).
const COMPILEES = REGLES.map(([f, s, mots]) => [f, s, new RegExp(`(?:^|[^a-z0-9])(?:${mots.map((m) => sansAccents(m).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?:s|x)?(?=$|[^a-z0-9])`)] as const);
const RE_SURGELE = new RegExp(`(?:^|[^a-z0-9])(?:${MARQUEURS_SURGELE.join("|")})(?=$|[^a-z0-9])`);

// Passage d'une sous-catégorie « frais » vers son équivalent surgelé.
const VERS_SURGELE: Record<string, string> = {
  Viandes: "Viandes & volailles",
  Volailles: "Viandes & volailles",
  Charcuterie: "Viandes & volailles",
  "Poissons & fruits de mer": "Poissons & fruits de mer",
  Légumes: "Légumes & fruits",
  Fruits: "Légumes & fruits",
  "Herbes fraîches": "Légumes & fruits",
  Boulangerie: "Pains & viennoiseries",
  Traiteur: "Plats préparés",
};

/** Lit une famille écrite librement (« Frais », « surgelé », « Épicerie », « ambiant »…). */
export function lireFamille(texte: string | null | undefined): Famille | null {
  const t = sansAccents(texte ?? "").trim();
  if (!t) return null;
  if (/surgel|congel|negatif/.test(t)) return "surgele";
  if (/boisson|bar|cave|vin|biere|alcool|soft/.test(t)) return "boissons";
  if (/entretien|hygiene|droguerie|emballage|non.?alim|jetable|materiel/.test(t)) return "non_alimentaire";
  if (/sec|ambiant|epicerie|conserve/.test(t)) return "sec";
  if (/frais|froid|positif|cremerie|boucherie|maree|primeur|fruit|legume/.test(t)) return "frais";
  return null;
}

/** Retrouve la sous-catégorie connue la plus proche d'un texte libre, dans une famille donnée. */
export function lireSousCategorie(famille: Famille, texte: string | null | undefined): string | null {
  const t = sansAccents(texte ?? "").trim();
  if (!t) return null;
  const connue = FAMILLES[famille].sous.find((s) => sansAccents(s) === t || sansAccents(s).startsWith(t) || t.startsWith(sansAccents(s).split(/[ ,&]/)[0]));
  return connue ?? (texte ?? "").trim();
}

/** Devine famille et sous-catégorie d'après le nom (et une indication de conservation). */
export function devinerCategorie(nom: string, indice?: string | null): { famille: Famille | null; sous_categorie: string | null } {
  const t = sansAccents(nom);
  const familleIndiquee = lireFamille(indice);
  const surgele = familleIndiquee === "surgele" || RE_SURGELE.test(t);
  let trouve: { famille: Famille; sous: string } | null = null;
  for (const [f, s, re] of COMPILEES) {
    if (re.test(t)) {
      trouve = { famille: f, sous: s };
      break;
    }
  }
  if (surgele) {
    if (!trouve) return { famille: "surgele", sous_categorie: null };
    if (trouve.famille === "surgele") return { famille: "surgele", sous_categorie: trouve.sous };
    if (trouve.famille === "frais") return { famille: "surgele", sous_categorie: VERS_SURGELE[trouve.sous] ?? null };
  }
  if (!trouve) return { famille: familleIndiquee, sous_categorie: null };
  // Frites et glaces sans mention « surgelé » : on garde la famille indiquée si elle existe.
  if (trouve.famille === "surgele" && familleIndiquee && familleIndiquee !== "surgele") return { famille: familleIndiquee, sous_categorie: null };
  if (familleIndiquee && familleIndiquee !== trouve.famille) return { famille: familleIndiquee, sous_categorie: null };
  return { famille: trouve.famille, sous_categorie: trouve.sous };
}
