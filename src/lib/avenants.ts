// Avenants au contrat de travail : modification d'un élément du contrat, acceptée par écrit par
// les deux parties. Pur (pas d'accès réseau). Même format de texte que les contrats (voir contrats.ts).
//
// Rappels légaux intégrés aux alertes :
//   * toute modification d'un élément essentiel (rémunération, durée du travail, qualification,
//     lieu hors secteur…) exige l'accord écrit du salarié ;
//   * renouvellement d'un CDD : avenant signé avant le terme initial (art. L1243-13) ;
//   * renouvellement de la période d'essai : accord exprès et écrit avant la fin de la période initiale ;
//   * temps partiel : toute modification de la durée ou de la répartition passe par un avenant.

import { briques, MODELES, normaliser, PERIODICITES, STATUTS_FR } from "@/lib/contrats";
import type { Donnees, ModeleCle, Prime } from "@/lib/contrats";

export type TypeModif = "remuneration" | "duree" | "horaires" | "poste" | "lieu" | "renouvellement_cdd" | "renouvellement_essai" | "primes" | "autre";

export const MODIFS: Record<TypeModif, { label: string; aide: string; cdi?: boolean; cdd?: boolean }> = {
  remuneration: { label: "Salaire", aide: "Nouveau taux horaire" },
  duree: { label: "Durée du travail", aide: "Nouvelles heures hebdomadaires (ex. passage à temps plein)" },
  horaires: { label: "Répartition des horaires", aide: "Jours et horaires de travail" },
  poste: { label: "Poste et classification", aide: "Promotion, changement d'emploi" },
  lieu: { label: "Lieu de travail", aide: "Nouvel établissement ou adresse" },
  renouvellement_cdd: { label: "Renouvellement du CDD", aide: "Nouvelle date de fin", cdd: true },
  renouvellement_essai: { label: "Renouvellement de la période d'essai", aide: "Durée du renouvellement", cdi: true },
  primes: { label: "Primes", aide: "Ajout ou modification de primes" },
  autre: { label: "Autre clause", aide: "Texte libre" },
};

export type Avenant = {
  modifs: TypeModif[];
  date_effet: string;
  motif: string;
  nouveau_taux: string;
  nouvelles_heures: string;
  nouvelle_repartition: string;
  nouveau_poste: string;
  nouveau_statut: string;
  nouveau_niveau: string;
  nouvel_echelon: string;
  nouveau_lieu: string;
  nouvelle_date_fin: string;
  duree_renouvellement_essai: string;
  primes: Prime[];
  autre_texte: string;
  fait_a: string;
  fait_le: string;
};

export const AVENANT_VIDE: Avenant = {
  modifs: [],
  date_effet: "",
  motif: "",
  nouveau_taux: "",
  nouvelles_heures: "",
  nouvelle_repartition: "",
  nouveau_poste: "",
  nouveau_statut: "employe",
  nouveau_niveau: "",
  nouvel_echelon: "",
  nouveau_lieu: "",
  nouvelle_date_fin: "",
  duree_renouvellement_essai: "",
  primes: [],
  autre_texte: "",
  fait_a: "",
  fait_le: "",
};

/** Données d'un avenant enregistrées : l'avenant, plus une copie du contrat modifié. */
export type DonneesAvenant = { avenant: Avenant; contrat: Donnees; modele_parent: ModeleCle; date_contrat: string };

const { parties, eur, dateLongue, ou, leSalarie, LeSalarie, num, montantPrime } = briques;

export function alertesAvenant(modeleParent: ModeleCle, c: Donnees, a: Avenant): string[] {
  const al: string[] = [];
  if (!a.modifs.length) al.push("Choisis au moins un élément à modifier.");
  if (!a.date_effet) al.push("Indique la date d'effet de l'avenant.");
  if (a.modifs.includes("remuneration") && !num(a.nouveau_taux)) al.push("Salaire : indique le nouveau taux horaire.");
  if (a.modifs.includes("remuneration") && num(a.nouveau_taux) && num(a.nouveau_taux) < num(c.taux_horaire)) al.push("Baisse de salaire : elle n'est possible qu'avec l'accord exprès du salarié, et jamais sous les minima de la convention.");
  if (a.modifs.includes("duree") && !num(a.nouvelles_heures)) al.push("Durée du travail : indique le nouveau nombre d'heures.");
  if (a.modifs.includes("duree") && num(a.nouvelles_heures) < 35 && !a.nouvelle_repartition.trim() && !a.modifs.includes("horaires")) al.push("Temps partiel : précise la nouvelle répartition des heures.");
  if (a.modifs.includes("renouvellement_cdd")) {
    if (!a.nouvelle_date_fin) al.push("Renouvellement du CDD : indique la nouvelle date de fin.");
    if (c.date_fin && a.fait_le && a.fait_le > c.date_fin) al.push("Renouvellement du CDD : l'avenant doit être signé avant le terme initial, sinon le contrat devient un CDI.");
  }
  if (a.modifs.includes("renouvellement_essai")) {
    if (!a.duree_renouvellement_essai.trim()) al.push("Renouvellement de l'essai : indique sa durée.");
    if (!c.essai_renouvelable) al.push("Renouvellement de l'essai : le contrat initial doit prévoir cette possibilité ; ici il ne la prévoit pas.");
  }
  if (a.modifs.includes("poste") && !a.nouveau_poste.trim()) al.push("Poste : indique le nouvel emploi.");
  if (a.modifs.includes("lieu") && !a.nouveau_lieu.trim()) al.push("Lieu : indique le nouveau lieu de travail.");
  if (a.modifs.includes("autre") && !a.autre_texte.trim()) al.push("Autre clause : rédige la clause.");
  if (MODELES[modeleParent].pays === "FR" && a.modifs.includes("renouvellement_cdd") && modeleParent !== "fr_cdd") al.push("Le renouvellement ne concerne que les CDD.");
  return al;
}

export function genererAvenant(modeleParent: ModeleCle, brut: Donnees, a: Avenant, numero: number, dateContrat: string): string {
  const c = normaliser(brut);
  const pays = MODELES[modeleParent].pays;
  const effet = dateLongue(a.date_effet);
  let n = 0;
  const art = (titre: string, ...p: (string | false | null | undefined)[]) => [`## Article ${++n} – ${titre}`, ...p.filter((x): x is string => !!x)].join("\n\n");
  const h = num(a.nouvelles_heures);
  const t = num(a.nouveau_taux);
  const heuresRef = h || num(c.heures_hebdo);
  const mensuel = t && heuresRef ? (t * heuresRef * 52) / 12 : null;

  const articles: string[] = [];
  for (const m of a.modifs) {
    if (m === "remuneration")
      articles.push(
        art(
          "Rémunération",
          `À compter du ${effet}, le taux horaire brut de ${leSalarie(c)} est porté de ${num(c.taux_horaire) ? eur(num(c.taux_horaire)) : "[ancien taux]"} à **${t ? eur(t) : "[à compléter]"}**${mensuel ? `, soit un salaire mensuel brut de base de **${eur(mensuel)}** pour ${heuresRef.toLocaleString("fr-FR")} heures hebdomadaires` : ""}.`,
        ),
      );
    if (m === "duree")
      articles.push(
        art(
          "Durée du travail",
          `À compter du ${effet}, la durée du travail de ${leSalarie(c)} passe de ${ou(c.heures_hebdo)} à **${h ? h.toLocaleString("fr-FR") : "[à compléter]"} heures par semaine**${h && h >= 35 ? " (temps plein)" : h ? " (temps partiel)" : ""}.`,
          a.nouvelle_repartition.trim() && !a.modifs.includes("horaires") && `Ces heures sont réparties comme suit : ${a.nouvelle_repartition.trim()}.`,
          !a.modifs.includes("remuneration") && num(c.taux_horaire) && h ? `La rémunération est ajustée en conséquence : ${eur((num(c.taux_horaire) * h * 52) / 12)} brut par mois sur la base du taux horaire de ${eur(num(c.taux_horaire))}.` : null,
        ),
      );
    if (m === "horaires") articles.push(art("Répartition des horaires", `À compter du ${effet}, les heures de travail de ${leSalarie(c)} sont réparties comme suit : **${ou(a.nouvelle_repartition)}**.`, "Les horaires précis restent communiqués par écrit via le planning de l'établissement."));
    if (m === "poste")
      articles.push(
        art(
          "Emploi et qualification",
          `À compter du ${effet}, ${leSalarie(c)} occupe l'emploi de **${ou(a.nouveau_poste)}**${pays === "FR" ? `, statut ${STATUTS_FR[a.nouveau_statut]?.label ?? "Employé"}${a.nouveau_niveau ? `, niveau ${a.nouveau_niveau}` : ""}${a.nouvel_echelon ? `, échelon ${a.nouvel_echelon}` : ""}` : ""}, en remplacement de l'emploi de ${ou(c.fonction)}.`,
        ),
      );
    if (m === "lieu") articles.push(art("Lieu de travail", `À compter du ${effet}, ${leSalarie(c)} exerce ses fonctions à **${ou(a.nouveau_lieu)}**.`));
    if (m === "renouvellement_cdd")
      articles.push(
        art(
          "Renouvellement du contrat",
          `Le contrat à durée déterminée conclu le ${dateLongue(dateContrat)}, dont le terme était fixé au ${dateLongue(c.date_fin)}, est renouvelé jusqu'au **${dateLongue(a.nouvelle_date_fin)}**, pour le même motif.`,
          "Ce renouvellement intervient dans les limites de durée et de nombre fixées par la loi et la convention collective.",
        ),
      );
    if (m === "renouvellement_essai")
      articles.push(
        art(
          "Renouvellement de la période d'essai",
          `D'un commun accord, et avant le terme de la période d'essai initiale de ${ou(c.essai)}, la période d'essai est renouvelée pour une durée de **${ou(a.duree_renouvellement_essai)}**.`,
          `${LeSalarie(c)} déclare accepter expressément ce renouvellement.`,
        ),
      );
    if (m === "primes" && a.primes.length)
      articles.push(art("Primes", `À compter du ${effet}, ${leSalarie(c)} bénéficie des éléments de rémunération suivants :\n${a.primes.map((p) => `- **${p.libelle}** : ${montantPrime(p)}${p.condition.trim() ? `, ${p.condition.trim()}` : ""}.`).join("\n")}`));
    if (m === "autre" && a.autre_texte.trim()) articles.push(art("Disposition particulière", a.autre_texte.trim()));
  }

  const objet = a.modifs.map((m) => MODIFS[m].label.toLowerCase()).join(", ");
  return [
    `# Avenant n° ${numero} au contrat de travail`,
    `#> Contrat ${MODELES[modeleParent].court} du ${dateLongue(dateContrat)} · ${ou(c.fonction)}`,
    parties(c, pays),
    `**PRÉAMBULE :** Les parties sont liées par un contrat de travail (${MODELES[modeleParent].label.toLowerCase()}) conclu le ${dateLongue(dateContrat)}. Elles sont convenues de le modifier sur les points suivants : ${objet || "[à compléter]"}, à compter du ${effet}.${a.motif.trim() ? ` ${a.motif.trim()}` : ""}`,
    "**IL A ÉTÉ CONVENU ET ARRÊTÉ CE QUI SUIT :**",
    ...articles,
    art("Autres clauses", "Toutes les autres clauses du contrat de travail initial et de ses éventuels avenants demeurent inchangées et continuent de s'appliquer."),
    `Fait à ${ou(a.fait_a)}, le ${dateLongue(a.fait_le)}, en deux exemplaires originaux dont un remis à ${leSalarie(c)}.`,
  ].join("\n\n");
}

/** Nom de l'avenant : NOM_Prénom_AVENANT-n_POSTE_DATE. */
export function nomAvenant(c: Partial<Donnees>, numero: number, dateEffet: string) {
  const d = normaliser(c);
  const propre = (s: string) => s.trim().replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, "-").replace(/-+/g, "-");
  const formes = d.fonction.split(" / ");
  const poste = formes.length === 2 ? formes[d.civilite === "Mme" ? 1 : 0] : d.fonction;
  return [propre(d.nom).toUpperCase(), propre(d.prenom), `AVENANT-${numero}`, propre(poste), dateEffet || "sans-date"].filter(Boolean).join("_");
}

export { PERIODICITES };
