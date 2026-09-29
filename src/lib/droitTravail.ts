// Règles de droit du travail utilisées par les contrats (valeurs vérifiées en septembre 2026).
//
// Sources :
//   * période d'essai (loi, art. L1221-19 et s.) et renouvellement HCR (CCN HCR, art. 13) ;
//   * préavis : CCN HCR (IDCC 1979), restauration rapide (IDCC 1501), restauration collective
//     (IDCC 1266) ; Belgique : loi du 3 juillet 1978, art. 37/2 (démission) ;
//   * repas : avantage en nature HCR = minimum garanti (4,35 € depuis le 1er juin 2026),
//     barème URSSAF hors HCR 5,50 € (2026) ;
//   * titres-restaurant : part patronale entre 50 et 60 % de la valeur, exonérée jusqu'à 7,32 € (2026).
// À réviser chaque année (minimum garanti, barèmes URSSAF, plafond des titres-restaurant).

export type Statut = "employe" | "maitrise" | "cadre";
/** Palier d'ancienneté : jusqu'à `moins_de` mois exclus (null = au-delà). */
export type Palier = { moins_de: number | null; duree: string };

export type Convention = {
  cle: string;
  intitule: string;
  idcc: string;
  /** Durée initiale maximale de l'essai en CDI (mois). */
  essai: Record<Statut, number>;
  /** Renouvellement autorisé par la convention (mois) ; 0 = interdit ; null = à vérifier. */
  renouvellement: Record<Statut, number | null>;
  preavis: { demission: Record<Statut, Palier[]>; licenciement: Record<Statut, Palier[]> } | null;
  /** Valeur par défaut d'un repas fourni (avantage en nature, €). */
  repas: number;
  repasSource: string;
};

const LEGAL_ESSAI: Record<Statut, number> = { employe: 2, maitrise: 3, cadre: 4 };

export const CONVENTIONS: Record<string, Convention> = {
  hcr: {
    cle: "hcr",
    intitule: "Convention collective nationale des hôtels, cafés, restaurants (HCR) du 30 avril 1997",
    idcc: "1979",
    essai: LEGAL_ESSAI,
    renouvellement: { employe: 2, maitrise: 3, cadre: 4 },
    preavis: {
      demission: {
        employe: [{ moins_de: 6, duree: "8 jours" }, { moins_de: 24, duree: "15 jours" }, { moins_de: null, duree: "1 mois" }],
        maitrise: [{ moins_de: 6, duree: "15 jours" }, { moins_de: 24, duree: "1 mois" }, { moins_de: null, duree: "2 mois" }],
        cadre: [{ moins_de: 6, duree: "1 mois" }, { moins_de: null, duree: "3 mois" }],
      },
      licenciement: {
        employe: [{ moins_de: 6, duree: "8 jours" }, { moins_de: 24, duree: "1 mois" }, { moins_de: null, duree: "2 mois" }],
        maitrise: [{ moins_de: 6, duree: "15 jours" }, { moins_de: 24, duree: "1 mois" }, { moins_de: null, duree: "2 mois" }],
        cadre: [{ moins_de: 6, duree: "1 mois" }, { moins_de: null, duree: "3 mois" }],
      },
    },
    repas: 4.35,
    repasSource: "minimum garanti au 1er juin 2026",
  },
  rapide: {
    cle: "rapide",
    intitule: "Convention collective nationale de la restauration rapide du 18 mars 1988",
    idcc: "1501",
    essai: LEGAL_ESSAI,
    renouvellement: { employe: null, maitrise: null, cadre: null },
    preavis: {
      demission: {
        employe: [{ moins_de: 6, duree: "8 jours" }, { moins_de: null, duree: "1 mois" }],
        maitrise: [{ moins_de: 24, duree: "1 mois" }, { moins_de: null, duree: "2 mois" }],
        cadre: [{ moins_de: null, duree: "3 mois" }],
      },
      licenciement: {
        employe: [{ moins_de: 6, duree: "8 jours" }, { moins_de: 24, duree: "1 mois" }, { moins_de: null, duree: "2 mois" }],
        maitrise: [{ moins_de: 24, duree: "1 mois" }, { moins_de: null, duree: "2 mois" }],
        cadre: [{ moins_de: null, duree: "3 mois" }],
      },
    },
    repas: 5.5,
    repasSource: "barème URSSAF 2026",
  },
  collective: {
    cle: "collective",
    intitule: "Convention collective nationale du personnel des entreprises de restauration de collectivités du 20 juin 1983",
    idcc: "1266",
    essai: LEGAL_ESSAI,
    renouvellement: { employe: 0, maitrise: 1, cadre: 2 },
    preavis: {
      demission: {
        employe: [{ moins_de: 6, duree: "8 jours" }, { moins_de: null, duree: "1 mois" }],
        maitrise: [{ moins_de: 24, duree: "1 mois" }, { moins_de: null, duree: "2 mois" }],
        cadre: [{ moins_de: null, duree: "3 mois" }],
      },
      licenciement: {
        employe: [{ moins_de: 6, duree: "8 jours" }, { moins_de: 24, duree: "1 mois" }, { moins_de: null, duree: "2 mois" }],
        maitrise: [{ moins_de: 24, duree: "1 mois" }, { moins_de: null, duree: "2 mois" }],
        cadre: [{ moins_de: null, duree: "3 mois" }],
      },
    },
    repas: 5.5,
    repasSource: "barème URSSAF 2026",
  },
  autre: {
    cle: "autre",
    intitule: "",
    idcc: "",
    essai: LEGAL_ESSAI,
    renouvellement: { employe: null, maitrise: null, cadre: null },
    preavis: null,
    repas: 5.5,
    repasSource: "barème URSSAF 2026",
  },
};

export const LIBELLES_CONVENTIONS: Record<string, string> = {
  hcr: "Hôtels, cafés, restaurants (HCR · IDCC 1979)",
  rapide: "Restauration rapide (IDCC 1501)",
  collective: "Restauration de collectivités (IDCC 1266)",
  autre: "Autre convention (à préciser)",
};

/** Préavis minimal légal de licenciement (art. L1234-1), pour une convention non détaillée. */
export const PREAVIS_LEGAL: Palier[] = [{ moins_de: 6, duree: "selon la convention collective ou l'usage" }, { moins_de: 24, duree: "1 mois" }, { moins_de: null, duree: "2 mois" }];

export function paliersEnTexte(paliers: Palier[]) {
  let depuis = 0;
  return paliers.map((p) => {
    const tranche = p.moins_de === null ? (depuis === 0 ? "quelle que soit l'ancienneté" : `${libelleMois(depuis)} d'ancienneté et plus`) : depuis === 0 ? `moins de ${libelleMois(p.moins_de)} d'ancienneté` : `de ${libelleMois(depuis)} à moins de ${libelleMois(p.moins_de)}`;
    depuis = p.moins_de ?? depuis;
    return `${tranche} : ${p.duree}`;
  });
}

function libelleMois(m: number) {
  return m % 12 === 0 ? `${m / 12} an${m / 12 > 1 ? "s" : ""}` : `${m} mois`;
}

/** Délais de prévenance en cas de rupture de la période d'essai (art. L1221-25 et L1221-26). */
export const PREVENANCE_ESSAI = {
  employeur: ["24 heures avant 8 jours de présence", "48 heures de 8 jours à 1 mois", "2 semaines après 1 mois", "1 mois après 3 mois de présence"],
  salarie: ["24 heures avant 8 jours de présence", "48 heures au-delà"],
};

/** Belgique : préavis de démission (loi du 3 juillet 1978, art. 37/2), en semaines. */
export const PREAVIS_DEMISSION_BE: Palier[] = [
  { moins_de: 3, duree: "1 semaine" },
  { moins_de: 6, duree: "2 semaines" },
  { moins_de: 12, duree: "3 semaines" },
  { moins_de: 18, duree: "4 semaines" },
  { moins_de: 24, duree: "5 semaines" },
  { moins_de: 48, duree: "6 semaines" },
  { moins_de: 60, duree: "7 semaines" },
  { moins_de: 72, duree: "9 semaines" },
  { moins_de: 84, duree: "10 semaines" },
  { moins_de: 96, duree: "12 semaines" },
  { moins_de: null, duree: "13 semaines" },
];

/** Titres-restaurant 2026. */
export const TITRES_RESTAURANT = { partMin: 50, partMax: 60, plafondExonere: 7.32 };
