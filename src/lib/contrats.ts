// Contrats de travail : modèles et génération du texte. Pur (pas d'accès réseau).
//
// Modèles France (convention collective HCR, IDCC 1979) et Belgique (CP 302 Horeca). Ce sont des
// trames de départ : le texte généré reste modifiable et doit être relu par l'employeur (ou son
// expert-comptable / avocat) avant signature. Le texte produit est du « markdown léger » :
//   « # » titre du contrat, « ## » article, lignes vides entre paragraphes.

export type Pays = "FR" | "BE";
export type ModeleCle = "fr_cdi" | "fr_cdd" | "fr_extra" | "be_cdi" | "be_cdd" | "be_extra";

export const MODELES: Record<ModeleCle, { label: string; pays: Pays; description: string }> = {
  fr_cdi: { label: "CDI (temps plein ou partiel)", pays: "FR", description: "Contrat à durée indéterminée, convention HCR" },
  fr_cdd: { label: "CDD", pays: "FR", description: "Remplacement, accroissement temporaire d'activité ou saisonnier" },
  fr_extra: { label: "Extra (CDD d'usage)", pays: "FR", description: "Mission ponctuelle, usage constant du secteur HCR" },
  be_cdi: { label: "Contrat à durée indéterminée", pays: "BE", description: "Commission paritaire 302 (Horeca)" },
  be_cdd: { label: "Contrat à durée déterminée", pays: "BE", description: "Commission paritaire 302 (Horeca)" },
  be_extra: { label: "Travailleur occasionnel (extra)", pays: "BE", description: "Horeca, 50 jours maximum par an, Dimona obligatoire" },
};

export const MOTIFS_CDD: Record<string, string> = {
  remplacement: "Remplacement d'un salarié absent",
  accroissement: "Accroissement temporaire d'activité",
  saisonnier: "Emploi à caractère saisonnier",
};

export const STATUTS_FR: Record<string, { label: string; essaiCdiMois: number }> = {
  employe: { label: "Employé", essaiCdiMois: 2 },
  maitrise: { label: "Agent de maîtrise", essaiCdiMois: 3 },
  cadre: { label: "Cadre", essaiCdiMois: 4 },
};

export type Donnees = {
  // Salarié
  civilite: "M." | "Mme";
  prenom: string;
  nom: string;
  date_naissance: string;
  lieu_naissance: string;
  nationalite: string;
  adresse: string;
  numero_securite: string; // n° sécurité sociale (FR) ou registre national (BE)
  // Employeur
  employeur: string;
  employeur_adresse: string;
  employeur_numero: string; // SIRET (FR) ou n° d'entreprise (BE)
  representant: string;
  representant_qualite: string;
  // Emploi
  fonction: string;
  statut: string; // FR : employe / maitrise / cadre ; BE : employe / ouvrier
  niveau: string;
  echelon: string;
  lieu_travail: string;
  date_debut: string;
  date_fin: string;
  motif: string;
  motif_detail: string; // nom et poste du salarié remplacé, nature du surcroît…
  duree_minimale: string;
  essai: string;
  // Temps et rémunération
  heures_hebdo: string;
  repartition: string;
  horaires_mission: string;
  taux_horaire: string;
  avantage_nourriture: boolean;
  mutuelle: string;
  clauses: string;
  // Signature
  fait_a: string;
  fait_le: string;
};

export const DONNEES_VIDES: Donnees = {
  civilite: "M.",
  prenom: "",
  nom: "",
  date_naissance: "",
  lieu_naissance: "",
  nationalite: "française",
  adresse: "",
  numero_securite: "",
  employeur: "",
  employeur_adresse: "",
  employeur_numero: "",
  representant: "",
  representant_qualite: "Gérant",
  fonction: "",
  statut: "employe",
  niveau: "I",
  echelon: "1",
  lieu_travail: "",
  date_debut: "",
  date_fin: "",
  motif: "accroissement",
  motif_detail: "",
  duree_minimale: "",
  essai: "",
  heures_hebdo: "35",
  repartition: "",
  horaires_mission: "",
  taux_horaire: "",
  avantage_nourriture: true,
  mutuelle: "",
  clauses: "",
  fait_a: "",
  fait_le: "",
};

const num = (s: string) => Number(String(s).replace(",", "."));
const eur = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const heures = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const date = (iso: string) => (iso ? new Date(iso + "T12:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "[date à compléter]");
const ou = (v: string, defaut = "[à compléter]") => (v?.trim() ? v.trim() : defaut);
const il = (d: Donnees) => (d.civilite === "Mme" ? "elle" : "il");
const leSalarie = (d: Donnees) => (d.civilite === "Mme" ? "la salariée" : "le salarié");
const LeSalarie = (d: Donnees) => (d.civilite === "Mme" ? "La salariée" : "Le salarié");

/** Salaire mensuel brut de base : taux horaire × heures hebdo × 52 / 12. */
export function salaireMensuel(d: Pick<Donnees, "taux_horaire" | "heures_hebdo">) {
  const t = num(d.taux_horaire);
  const h = num(d.heures_hebdo);
  if (!t || !h) return null;
  return (t * h * 52) / 12;
}

function joursEntre(a: string, b: string) {
  return Math.round((new Date(b + "T12:00").getTime() - new Date(a + "T12:00").getTime()) / 864e5) + 1;
}

/** Période d'essai proposée (maximum légal) ; modifiable dans le formulaire. */
export function essaiPropose(modele: ModeleCle, d: Donnees): string {
  if (modele === "fr_cdi") return `${STATUTS_FR[d.statut]?.essaiCdiMois ?? 2} mois`;
  if (modele === "fr_cdd") {
    if (!d.date_debut || !d.date_fin) return "1 jour par semaine de contrat";
    const jours = joursEntre(d.date_debut, d.date_fin);
    if (jours > 183) return "1 mois";
    const j = Math.min(14, Math.max(1, Math.ceil(jours / 7)));
    return `${j} jour${j > 1 ? "s" : ""}`;
  }
  return "";
}

export function alertes(modele: ModeleCle, d: Donnees): string[] {
  const a: string[] = [];
  const h = num(d.heures_hebdo);
  if (MODELES[modele].pays === "FR" && modele !== "fr_extra") {
    if (h && h < 35 && !d.repartition.trim()) a.push("Temps partiel : la répartition des heures entre les jours de la semaine est obligatoire.");
    if (h && h < 24) a.push("Moins de 24 h par semaine : possible seulement à la demande écrite du salarié ou dans les cas prévus par la loi.");
  }
  if ((modele === "fr_cdd" || modele === "be_cdd") && !d.date_fin && !d.duree_minimale) a.push("CDD : indique une date de fin, ou une durée minimale (remplacement).");
  if (modele === "fr_cdd" && d.motif === "remplacement" && !d.motif_detail.trim()) a.push("Remplacement : le nom et la qualification du salarié remplacé doivent figurer au contrat.");
  if (!d.numero_securite.trim()) a.push(MODELES[modele].pays === "FR" ? "N° de sécurité sociale manquant." : "N° de registre national manquant.");
  if (!num(d.taux_horaire)) a.push("Rémunération manquante.");
  return a;
}

function article(n: number, titre: string, ...paragraphes: (string | false | null | undefined)[]) {
  return [`## Article ${n} – ${titre}`, ...paragraphes.filter((p): p is string => !!p)].join("\n\n");
}

function parties(d: Donnees, pays: Pays) {
  return [
    "**Entre les soussignés :**",
    `${ou(d.employeur)}, ${pays === "FR" ? `SIRET ${ou(d.employeur_numero)}` : `numéro d'entreprise ${ou(d.employeur_numero)}`}, dont le siège est situé ${ou(d.employeur_adresse)}, représenté(e) par ${ou(d.representant)}, en qualité de ${ou(d.representant_qualite)}, ci-après « l'employeur »,`,
    "**Et :**",
    `${d.civilite} ${ou(d.prenom)} ${ou(d.nom)}, né${d.civilite === "Mme" ? "e" : ""} le ${date(d.date_naissance)} à ${ou(d.lieu_naissance)}, de nationalité ${ou(d.nationalite)}, demeurant ${ou(d.adresse)}, ${pays === "FR" ? "n° de sécurité sociale" : "n° de registre national"} ${ou(d.numero_securite)}, ci-après « ${leSalarie(d)} »,`,
    "**Il a été convenu ce qui suit :**",
  ].join("\n\n");
}

function remuneration(d: Donnees, pays: Pays, mensuel: boolean) {
  const t = num(d.taux_horaire);
  const m = salaireMensuel(d);
  const base = mensuel && m ? `une rémunération mensuelle brute de ${eur(m)} pour ${heures(num(d.heures_hebdo))} heures hebdomadaires, soit un taux horaire brut de ${eur(t)}` : `un taux horaire brut de ${t ? eur(t) : "[à compléter]"}`;
  return [
    `En contrepartie de son travail, ${leSalarie(d)} percevra ${base}.`,
    pays === "FR" &&
      "Les heures effectuées au-delà de la durée prévue donneront lieu aux majorations prévues par la convention collective et la loi.",
    pays === "FR" && d.avantage_nourriture && "Conformément à la convention collective, les repas pris dans l'établissement constituent un avantage en nature nourriture, valorisé selon le barème en vigueur, ou donnent lieu à l'indemnité compensatrice correspondante.",
    d.mutuelle.trim() && `${LeSalarie(d)} bénéficie de la complémentaire santé et prévoyance de l'entreprise : ${d.mutuelle.trim()}.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function obligations(d: Donnees) {
  return `${LeSalarie(d)} s'engage à respecter les consignes d'hygiène et de sécurité alimentaire (plan de maîtrise sanitaire, HACCP), le règlement intérieur et les instructions de l'employeur, à porter la tenue de travail fournie et à observer une discrétion absolue sur les informations dont ${il(d)} aurait connaissance dans l'exercice de ses fonctions.`;
}

function signatures(d: Donnees) {
  return [`Fait à ${ou(d.fait_a)}, le ${date(d.fait_le)}, en deux exemplaires originaux dont un remis à ${leSalarie(d)}.`, "Signatures précédées de la mention « Lu et approuvé »."].join("\n\n");
}

/** Texte complet du contrat. */
export function genererContrat(modele: ModeleCle, d: Donnees): string {
  const pays = MODELES[modele].pays;
  const h = num(d.heures_hebdo);
  const partiel = h > 0 && h < (pays === "FR" ? 35 : 38);
  const statut = pays === "FR" ? STATUTS_FR[d.statut]?.label ?? "Employé" : d.statut === "ouvrier" ? "ouvrier" : "employé";
  const qualif = pays === "FR" ? `${statut}, niveau ${ou(d.niveau)}, échelon ${ou(d.echelon)} de la grille de classification de la convention collective` : `${statut} relevant de la commission paritaire 302 (Horeca)`;
  const libre = d.clauses.trim() ? [d.clauses.trim()] : [];
  let n = 0;
  const a = (titre: string, ...p: (string | false | null | undefined)[]) => article(++n, titre, ...p);

  if (modele === "fr_cdi") {
    return [
      `# Contrat de travail à durée indéterminée${partiel ? " à temps partiel" : ""}`,
      parties(d, pays),
      a("Engagement", `${LeSalarie(d)} est engagé${d.civilite === "Mme" ? "e" : ""} à compter du ${date(d.date_debut)} pour une durée indéterminée, sous réserve des résultats de la visite d'information et de prévention.`, "Le présent contrat est régi par la convention collective nationale des hôtels, cafés, restaurants (HCR) du 30 avril 1997 (IDCC 1979), dont un exemplaire est tenu à disposition dans l'établissement."),
      a("Fonctions et qualification", `${LeSalarie(d)} occupera l'emploi de ${ou(d.fonction)}, statut ${qualif}.`, "Ces fonctions pourront évoluer en fonction des nécessités de l'entreprise, sans modification de la qualification."),
      a("Période d'essai", `Le contrat ne deviendra définitif qu'à l'issue d'une période d'essai de ${ou(d.essai)} de travail effectif, pendant laquelle chacune des parties pourra y mettre fin en respectant le délai de prévenance légal. Elle pourra être renouvelée une fois dans les conditions prévues par la convention collective, avec l'accord écrit de ${leSalarie(d)}.`),
      a("Lieu de travail", `${LeSalarie(d)} exercera ses fonctions à ${ou(d.lieu_travail)}.`),
      a(
        "Durée du travail",
        partiel
          ? `${LeSalarie(d)} est engagé${d.civilite === "Mme" ? "e" : ""} à temps partiel pour une durée de ${heures(h)} heures par semaine, réparties comme suit : ${ou(d.repartition)}. Cette répartition pourra être modifiée en respectant un délai de prévenance de 7 jours. Les heures complémentaires ne pourront excéder le dixième de la durée prévue, sauf accord collectif le permettant.`
          : `La durée du travail est fixée à ${heures(h)} heures par semaine${d.repartition.trim() ? `, réparties comme suit : ${d.repartition.trim()}` : ""}. Les horaires sont communiqués par le planning affiché dans l'établissement.`,
        "Compte tenu de l'activité de restauration, le travail pourra être organisé les week-ends et jours fériés, dans le respect du repos hebdomadaire.",
      ),
      a("Rémunération", remuneration(d, pays, true)),
      a("Congés payés", `${LeSalarie(d)} bénéficiera des congés payés prévus par la loi, soit 2,5 jours ouvrables par mois de travail effectif, dont les dates sont fixées par l'employeur.`),
      a("Protection sociale", `${LeSalarie(d)} sera affilié${d.civilite === "Mme" ? "e" : ""} aux caisses de retraite complémentaire et de prévoyance dont relève l'entreprise.`),
      a("Obligations", obligations(d)),
      ...(libre.length ? [a("Dispositions particulières", ...libre)] : []),
      a("Rupture du contrat", "Après la période d'essai, le contrat pourra être rompu dans les conditions prévues par la loi et la convention collective, sous réserve du préavis applicable."),
      signatures(d),
    ].join("\n\n");
  }

  if (modele === "fr_cdd") {
    const terme = d.date_fin
      ? `Il prendra effet le ${date(d.date_debut)} et prendra fin le ${date(d.date_fin)}.`
      : `Il prendra effet le ${date(d.date_debut)}, pour une durée minimale de ${ou(d.duree_minimale)}, et prendra fin au retour du salarié remplacé.`;
    const motif = d.motif === "remplacement" ? `du remplacement de ${ou(d.motif_detail)}, absent(e)` : d.motif === "saisonnier" ? `d'un emploi à caractère saisonnier${d.motif_detail.trim() ? ` (${d.motif_detail.trim()})` : ""}` : `d'un accroissement temporaire d'activité${d.motif_detail.trim() ? ` : ${d.motif_detail.trim()}` : ""}`;
    return [
      `# Contrat de travail à durée déterminée${partiel ? " à temps partiel" : ""}`,
      parties(d, pays),
      a("Motif du contrat", `Le présent contrat est conclu en application de l'article L. 1242-2 du Code du travail, au titre ${motif}.`),
      a("Durée", terme, d.date_fin && "Le contrat pourra être renouvelé dans les limites légales, par avenant soumis à l'accord de " + leSalarie(d) + " avant son terme."),
      a("Fonctions et qualification", `${LeSalarie(d)} occupera l'emploi de ${ou(d.fonction)}, statut ${qualif} de la convention collective HCR (IDCC 1979).`),
      a("Période d'essai", `Le contrat comporte une période d'essai de ${ou(d.essai)}.`),
      a("Lieu de travail", `${LeSalarie(d)} exercera ses fonctions à ${ou(d.lieu_travail)}.`),
      a("Durée du travail", partiel ? `Durée de ${heures(h)} heures par semaine, réparties comme suit : ${ou(d.repartition)}.` : `La durée du travail est fixée à ${heures(h)} heures par semaine${d.repartition.trim() ? `, réparties comme suit : ${d.repartition.trim()}` : ""}.`),
      a("Rémunération", remuneration(d, pays, true), d.motif !== "saisonnier" && `À l'issue du contrat, ${leSalarie(d)} percevra, sauf exceptions légales, une indemnité de fin de contrat égale à 10 % de la rémunération totale brute perçue, ainsi qu'une indemnité compensatrice de congés payés.`),
      a("Obligations", obligations(d)),
      ...(libre.length ? [a("Dispositions particulières", ...libre)] : []),
      signatures(d),
    ].join("\n\n");
  }

  if (modele === "fr_extra") {
    return [
      "# Contrat de travail à durée déterminée d'usage (extra)",
      parties(d, pays),
      a("Motif", "Le présent contrat est conclu en application des articles L. 1242-2 3° et D. 1242-1 du Code du travail, l'emploi d'extra relevant d'un usage constant dans le secteur des hôtels, cafés, restaurants, en raison de la nature de l'activité et du caractère par nature temporaire de cet emploi."),
      a("Mission", `${LeSalarie(d)} est engagé${d.civilite === "Mme" ? "e" : ""} en qualité de ${ou(d.fonction)} (${qualif} de la convention collective HCR) pour la mission suivante : le ${date(d.date_debut)}${d.date_fin && d.date_fin !== d.date_debut ? ` au ${date(d.date_fin)}` : ""}, ${ou(d.horaires_mission, "horaires communiqués à l'embauche")}.`, `Lieu : ${ou(d.lieu_travail)}.`),
      a("Rémunération", remuneration(d, pays, false), "Conformément à l'usage, le contrat d'extra ne donne pas lieu à l'indemnité de fin de contrat. L'indemnité compensatrice de congés payés (10 %) est versée à l'issue de la mission."),
      a("Obligations", obligations(d)),
      ...(libre.length ? [a("Dispositions particulières", ...libre)] : []),
      signatures(d),
    ].join("\n\n");
  }

  // Belgique (CP 302)
  const regime = partiel ? `à temps partiel, ${heures(h)} heures par semaine, selon l'horaire suivant : ${ou(d.repartition)}` : `à temps plein, ${heures(h)} heures par semaine${d.repartition.trim() ? ` (${d.repartition.trim()})` : ""}`;
  if (modele === "be_extra") {
    return [
      "# Contrat de travail de travailleur occasionnel (Horeca)",
      parties(d, pays),
      a("Objet", `L'employeur engage ${leSalarie(d)} en qualité de travailleur occasionnel (extra) dans le secteur Horeca (CP 302), en tant que ${ou(d.fonction)}, conformément à l'article 31ter de l'arrêté royal du 28 novembre 1969.`),
      a("Durée et horaire", `Le contrat est conclu pour le ${date(d.date_debut)}${d.date_fin && d.date_fin !== d.date_debut ? ` au ${date(d.date_fin)}` : ""}, ${ou(d.horaires_mission, "selon l'horaire convenu")}. Une déclaration Dimona est effectuée avant le début des prestations. Le travailleur occasionnel ne peut être occupé plus de 50 jours par année civile sous ce régime.`),
      a("Lieu de travail", ou(d.lieu_travail)),
      a("Rémunération", remuneration(d, pays, false)),
      a("Obligations", obligations(d)),
      ...(libre.length ? [a("Dispositions particulières", ...libre)] : []),
      signatures(d),
    ].join("\n\n");
  }
  return [
    `# Contrat de travail d'${d.statut === "ouvrier" ? "ouvrier" : "employé"} à durée ${modele === "be_cdi" ? "indéterminée" : "déterminée"}`,
    parties(d, pays),
    a("Engagement", `L'employeur engage ${leSalarie(d)} en qualité de ${ou(d.fonction)}, ${qualif}, à partir du ${date(d.date_debut)}${modele === "be_cdd" ? ` jusqu'au ${date(d.date_fin)}` : " pour une durée indéterminée"}.`, "Le contrat est régi par la loi du 3 juillet 1978 relative aux contrats de travail et par les conventions collectives de la commission paritaire 302."),
    a("Lieu de travail", ou(d.lieu_travail)),
    a("Durée du travail", `${LeSalarie(d)} est occupé${d.civilite === "Mme" ? "e" : ""} ${regime}. L'horaire de travail figure au règlement de travail.`),
    a("Rémunération", remuneration(d, pays, true), "La rémunération est payée par virement, au plus tard le quatrième jour ouvrable qui suit la période de paie. Elle suit l'indexation prévue par la commission paritaire."),
    a("Vacances annuelles", "Le travailleur bénéficie des vacances annuelles et du pécule de vacances conformément à la législation belge."),
    a("Règlement de travail", `${LeSalarie(d)} reconnaît avoir reçu un exemplaire du règlement de travail de l'entreprise.`),
    a("Obligations", obligations(d)),
    ...(libre.length ? [a("Dispositions particulières", ...libre)] : []),
    a("Fin du contrat", modele === "be_cdi" ? "Le contrat peut être rompu moyennant le respect des délais de préavis prévus par la loi." : "Le contrat prend fin de plein droit à son terme. Des contrats à durée déterminée successifs ne sont possibles que dans les limites légales."),
    signatures(d),
  ].join("\n\n");
}

/** Découpe le texte en blocs pour l'affichage (titres, articles, paragraphes avec **gras**). */
export function blocs(texte: string) {
  return texte.split(/\n{2,}/).map((b) => {
    if (b.startsWith("# ")) return { type: "titre" as const, texte: b.slice(2) };
    if (b.startsWith("## ")) return { type: "article" as const, texte: b.slice(3) };
    return { type: "para" as const, texte: b };
  });
}
