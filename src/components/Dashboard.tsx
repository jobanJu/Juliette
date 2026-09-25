"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import RecipeStockDemo from "@/components/RecipeStockDemo";

type Module = {
  icon: string;
  name: string;
  detail: string;
  color: string;
  badge: string;
};
type Task = {
  id: string;
  title: string;
  detail: string;
  done: boolean;
  urgent?: boolean;
};
type Activity = {
  id: string;
  icon: string;
  title: string;
  note: string;
  time: string;
  amount: string;
  tone: string;
};
type Modal = "action" | "add-record" | "profile" | "customize" | null;
type SavedData = {
  tasks?: Task[];
  activities?: Activity[];
  records?: Record<string, string[]>;
  hiddenModules?: string[];
  venue?: string;
  profileName?: string;
  profileRole?: string;
};

const MODULES: Module[] = [
  {
    icon: "◷",
    name: "Équipe",
    detail: "Planning, pointage et demandes",
    color: "lavender",
    badge: "2 demandes",
  },
  {
    icon: "♧",
    name: "HACCP",
    detail: "Contrôles et traçabilité",
    color: "mint",
    badge: "À jour",
  },
  {
    icon: "▤",
    name: "Stocks",
    detail: "Produits, inventaires et pertes",
    color: "peach",
    badge: "3 alertes",
  },
  {
    icon: "⌂",
    name: "Ventes & caisse",
    detail: "Commandes et suivi en direct",
    color: "blue",
    badge: "En service",
  },
  {
    icon: "↗",
    name: "Finances",
    detail: "Chiffre d’affaires et prévisions",
    color: "yellow",
    badge: "Aujourd’hui",
  },
  {
    icon: "⌘",
    name: "Établissement",
    detail: "Recettes, équipe et paramètres",
    color: "pink",
    badge: "12 fiches",
  },
  {
    icon: "▣",
    name: "Réservations",
    detail: "Tables, clients et services",
    color: "blue",
    badge: "Ce soir · 14",
  },
  {
    icon: "✦",
    name: "Évènements",
    detail: "Temps forts autour du restaurant",
    color: "yellow",
    badge: "Cette semaine",
  },
  {
    icon: "✉",
    name: "Messagerie",
    detail: "Les infos utiles de l’équipe",
    color: "lavender",
    badge: "2 nouveaux",
  },
];

const DEFAULT_TASKS: Task[] = [
  {
    id: "delivery",
    title: "Valider la livraison",
    detail: "Commande Metro · avant 11 h",
    done: false,
    urgent: true,
  },
  {
    id: "temperature",
    title: "Contrôle chambre froide",
    detail: "Terminé à 9 h 42",
    done: true,
  },
  {
    id: "schedule",
    title: "Publier le planning",
    detail: "Semaine du 29 sept.",
    done: false,
  },
];

const DEFAULT_ACTIVITIES: Activity[] = [
  {
    id: "loss",
    icon: "↘",
    title: "Perte déclarée",
    note: "Sauce tomate · Cuisine",
    time: "Il y a 8 min",
    amount: "− 1,2 kg",
    tone: "peach",
  },
  {
    id: "temp",
    icon: "✓",
    title: "Contrôle température",
    note: "Chambre froide · HACCP",
    time: "Il y a 24 min",
    amount: "3,4 °C",
    tone: "mint",
  },
  {
    id: "order",
    icon: "＋",
    title: "Commande fournisseur",
    note: "Légumes du marché",
    time: "Il y a 1 h",
    amount: "Confirmée",
    tone: "lavender",
  },
];

const MODULE_RECORDS: Record<string, string[]> = {
  Équipe: [
    "Planning de la semaine · 9 collaborateurs",
    "2 demandes en attente · congé et acompte",
    "Pointages du jour · 7 personnes présentes",
  ],
  HACCP: [
    "Chambre froide · 3,4 °C · Conforme",
    "Refroidissement sauce tomate · à contrôler",
    "Plan de nettoyage · cuisine · 2 tâches restantes",
  ],
  Stocks: [
    "Tomates · 120 unités · stock suivi",
    "Huile d’olive · 1 500 g · stock suivi",
    "Sauce tomate maison · fiche recette liée",
  ],
  "Ventes & caisse": [
    "18 commandes aujourd’hui · 6 en préparation",
    "Table 4 · commande en cours",
    "Rupture produit · aucune",
  ],
  Finances: [
    "Chiffre d’affaires du jour · 2 480 €",
    "Pertes déclarées · 1,2 kg",
    "Prévision de clôture · 3 900 €",
  ],
  Établissement: [
    "Maison Juliette · Lille Centre",
    "12 fiches techniques produits",
    "Équipe · 9 collaborateurs",
  ],
  Réservations: [
    "14 couverts prévus ce soir",
    "Table 4 · 19 h 30 · 2 personnes",
    "Table 8 · 20 h 00 · 4 personnes",
  ],
  Évènements: [
    "Marché de la place · samedi",
    "Concert au parc · vendredi soir",
    "Ajouter un évènement local",
  ],
  Messagerie: [
    "Nouveau message de Camille · service du midi",
    "Info équipe · changement de planning",
    "Canal général · Maison Juliette",
  ],
  Paramètres: [
    "Établissement · Maison Juliette",
    "Collaborateurs et droits d’accès",
    "Préférences et notifications",
  ],
  "Activité récente": [],
  Tâches: [],
};

const NAV_ITEMS = [
  { icon: "▦", label: "Vue d’ensemble", target: "" },
  { icon: "♧", label: "Opérations", target: "HACCP" },
  { icon: "◷", label: "Équipe", target: "Équipe", count: "2" },
  { icon: "▤", label: "Stocks", target: "Stocks", count: "3", alert: true },
  { icon: "⌂", label: "Ventes", target: "Ventes & caisse" },
  { icon: "↗", label: "Finances", target: "Finances" },
  { icon: "▣", label: "Réservations", target: "Réservations" },
];

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function Dashboard() {
  const [selectedModule, setSelectedModule] = useState("");
  const [tasks, setTasks] = useState(DEFAULT_TASKS);
  const [activities, setActivities] = useState(DEFAULT_ACTIVITIES);
  const [records, setRecords] = useState<Record<string, string[]>>({});
  const [hiddenModules, setHiddenModules] = useState<string[]>([]);
  const [venue, setVenue] = useState("Maison Juliette · Lille Centre");
  const [profileName, setProfileName] = useState("Julien Dupont");
  const [profileRole, setProfileRole] = useState("Administrateur");
  const [modal, setModal] = useState<Modal>(null);
  const [menuOpen, setMenuOpen] = useState<
    "venue" | "profile" | "notifications" | null
  >(null);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    // Différé d'un tick : localStorage n'existe qu'au navigateur, et un setState synchrone dans
    // un effet déclenche un rendu en cascade.
    void Promise.resolve().then(() => {
      try {
        const saved = localStorage.getItem("juliette-demo-state");
        if (saved) {
          const data = JSON.parse(saved) as SavedData;
          if (data.tasks) setTasks(data.tasks);
          if (data.activities) setActivities(data.activities);
          if (data.records) setRecords(data.records);
          if (data.hiddenModules) setHiddenModules(data.hiddenModules);
          if (data.venue) setVenue(data.venue);
          if (data.profileName) setProfileName(data.profileName);
          if (data.profileRole) setProfileRole(data.profileRole);
        }
      } catch {
        localStorage.removeItem("juliette-demo-state");
      }
      setStorageReady(true);
    });
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    const data: SavedData = {
      tasks,
      activities,
      records,
      hiddenModules,
      venue,
      profileName,
      profileRole,
    };
    localStorage.setItem("juliette-demo-state", JSON.stringify(data));
  }, [
    storageReady,
    tasks,
    activities,
    records,
    hiddenModules,
    venue,
    profileName,
    profileRole,
  ]);

  const visibleModules = useMemo(
    () => MODULES.filter((module) => !hiddenModules.includes(module.name)),
    [hiddenModules],
  );
  const openModule = (name: string) => {
    setSelectedModule(name);
    setMenuOpen(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const addActivity = (
    title: string,
    note: string,
    icon = "＋",
    tone = "lavender",
  ) => {
    setActivities((current) => [
      {
        id: makeId(),
        title,
        note,
        time: "À l’instant",
        amount: "Ajouté",
        icon,
        tone,
      },
      ...current,
    ]);
  };
  const toggleTask = (id: string) =>
    setTasks((current) =>
      current.map((task) =>
        task.id === id ? { ...task, done: !task.done } : task,
      ),
    );

  function handleActionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "Nouvelle action").trim();
    const detail = String(form.get("detail") || "Ajout manuel").trim();
    const type = String(form.get("type") || "Tâche");
    if (type === "Tâche") {
      setTasks((current) => [
        { id: makeId(), title, detail, done: false },
        ...current,
      ]);
    } else {
      const destination =
        type === "Contrôle HACCP"
          ? "HACCP"
          : type === "Demande RH"
            ? "Équipe"
            : "Stocks";
      setRecords((current) => ({
        ...current,
        [destination]: [
          ...(current[destination] || []),
          `${title}${detail ? ` · ${detail}` : ""}`,
        ],
      }));
    }
    addActivity(
      title,
      detail,
      type === "Contrôle HACCP" ? "✓" : "＋",
      type === "Contrôle HACCP" ? "mint" : "lavender",
    );
    setModal(null);
  }

  function handleRecordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const entry = String(form.get("record") || "").trim();
    if (!entry || !selectedModule) return;
    setRecords((current) => ({
      ...current,
      [selectedModule]: [...(current[selectedModule] || []), entry],
    }));
    addActivity(`Ajout dans ${selectedModule}`, entry);
    setModal(null);
  }

  function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setProfileName(String(form.get("name") || profileName).trim());
    setProfileRole(String(form.get("role") || profileRole).trim());
    setModal(null);
  }

  function handleCustomizeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selected = new FormData(event.currentTarget)
      .getAll("module")
      .map(String);
    setHiddenModules(
      MODULES.filter((module) => !selected.includes(module.name)).map(
        (module) => module.name,
      ),
    );
    setModal(null);
  }

  const tasksRemaining = tasks.filter((task) => !task.done).length;
  const moduleDescription =
    MODULES.find((module) => module.name === selectedModule)?.detail ??
    "Votre activité, réunie au même endroit.";
  const currentRecords =
    selectedModule === "Tâches"
      ? tasks.map(
          (task) => `${task.done ? "✓" : "○"} ${task.title} — ${task.detail}`,
        )
      : selectedModule === "Activité récente"
        ? activities.map(
            (item) => `${item.title} — ${item.note} · ${item.time}`,
          )
        : [
            ...(MODULE_RECORDS[selectedModule] || []),
            ...(records[selectedModule] || []),
          ];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => openModule("")}
          aria-label="Retour à la vue d’ensemble"
        >
          <span className="brand-mark">j</span>
          <span>
            juliette<span className="brand-dot">.</span>
          </span>
        </button>
        <div className="menu-anchor">
          <button
            className="venue-switch"
            onClick={() => setMenuOpen(menuOpen === "venue" ? null : "venue")}
            aria-expanded={menuOpen === "venue"}
          >
            <span className="venue-icon">{venue.charAt(0)}</span>
            <span className="venue-text">
              <b>{venue.split(" · ")[0]}</b>
              <small>{venue.split(" · ").slice(1).join(" · ")}</small>
            </span>
            <span className="chevron">⌄</span>
          </button>
          {menuOpen === "venue" && (
            <div className="popover venue-popover">
              <p className="popover-title">Établissements</p>
              {[
                "Maison Juliette · Lille Centre",
                "Brasserie du Parc · Lille",
              ].map((item) => (
                <button
                  className="popover-option"
                  key={item}
                  onClick={() => {
                    setVenue(item);
                    setMenuOpen(null);
                  }}
                >
                  {item}
                  {venue === item && <span>✓</span>}
                </button>
              ))}
              <small>Établissements de démonstration</small>
            </div>
          )}
        </div>
        <p className="nav-label">ESPACE DE TRAVAIL</p>
        <nav className="nav-list" aria-label="Navigation principale">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              className={`nav-item ${selectedModule === item.target ? "active" : ""}`}
              onClick={() => openModule(item.target)}
            >
              <span>{item.icon}</span>
              {item.label}
              {item.count && (
                <i className={item.alert ? "alert-count" : ""}>{item.count}</i>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className={`nav-item ${selectedModule === "Paramètres" ? "active" : ""}`}
            onClick={() => openModule("Paramètres")}
          >
            <span>⚙</span> Paramètres
          </button>
          <div className="profile">
            <div className="avatar">
              {profileName
                .split(" ")
                .map((name) => name[0])
                .slice(0, 2)
                .join("")}
            </div>
            <span>
              <b>{profileName}</b>
              <small>{profileRole}</small>
            </span>
            <button
              className="dots"
              aria-label="Modifier le profil"
              onClick={() => {
                setModal("profile");
                setMenuOpen(null);
              }}
            >
              ···
            </button>
          </div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            {venue.split(" · ")[0]} <span>/</span>{" "}
            <b>{selectedModule || "Vue d’ensemble"}</b>
          </div>
          <div className="top-actions">
            <span className="live">
              <i /> Mode démonstration
            </span>
            <div className="menu-anchor">
              <button
                className="icon-button"
                aria-label="Notifications"
                aria-expanded={menuOpen === "notifications"}
                onClick={() =>
                  setMenuOpen(
                    menuOpen === "notifications" ? null : "notifications",
                  )
                }
              >
                ♧<em />
              </button>
              {menuOpen === "notifications" && (
                <div className="popover notification-popover">
                  <p className="popover-title">
                    Notifications <span>2 nouvelles</span>
                  </p>
                  <button
                    className="notification-item"
                    onClick={() => openModule("Équipe")}
                  >
                    <b>Demande de congé</b>
                    <small>Camille · aujourd’hui à 10 h 12</small>
                  </button>
                  <button
                    className="notification-item"
                    onClick={() => openModule("Stocks")}
                  >
                    <b>Stock faible · tomates</b>
                    <small>Il reste 12 unités en réserve</small>
                  </button>
                </div>
              )}
            </div>
            <div className="today">Jeudi 25 septembre 2026</div>
          </div>
        </header>

        <div className="content">
          {selectedModule ? (
            <>
              <section className="workspace-header">
                <div>
                  <p className="eyebrow">{venue.toUpperCase()}</p>
                  <h1>{selectedModule}</h1>
                  <p className="welcome-copy">
                    {selectedModule === "Tâches"
                      ? `${tasksRemaining} tâche${tasksRemaining > 1 ? "s" : ""} à terminer aujourd’hui.`
                      : moduleDescription}
                  </p>
                </div>
                {selectedModule !== "Activité récente" && (
                  <button
                    className="primary-button"
                    onClick={() =>
                      setModal(
                        selectedModule === "Tâches" ? "action" : "add-record",
                      )
                    }
                  >
                    <span>＋</span>{" "}
                    {selectedModule === "Tâches" ? "Nouvelle tâche" : "Ajouter"}
                  </button>
                )}
              </section>
              {selectedModule === "Tâches" ? (
                <section className="panel workspace-panel">
                  {tasks.map((task) => (
                    <button
                      className="task-item task-button"
                      key={task.id}
                      onClick={() => toggleTask(task.id)}
                    >
                      <span className={`task-check ${task.done ? "done" : ""}`}>
                        {task.done ? "✓" : ""}
                      </span>
                      <span>
                        <b className={task.done ? "task-done" : ""}>
                          {task.title}
                        </b>
                        <small>{task.detail}</small>
                      </span>
                      {task.urgent && !task.done && (
                        <span className="task-priority">Urgent</span>
                      )}
                    </button>
                  ))}
                </section>
              ) : (
                <section className="panel workspace-panel">
                  <div className="workspace-list-heading">
                    <span>ÉLÉMENT</span>
                    <span>ÉTAT</span>
                  </div>
                  {currentRecords.map((record, index) => (
                    <div
                      className="workspace-record"
                      key={`${selectedModule}-${index}`}
                    >
                      <span className="record-icon">
                        {MODULES.find(
                          (module) => module.name === selectedModule,
                        )?.icon || "•"}
                      </span>
                      <span className="record-label">{record}</span>
                      <span className="record-state">
                        <i /> Démo
                      </span>
                    </div>
                  ))}
                  {currentRecords.length === 0 && (
                    <p className="empty-state">
                      Aucune activité pour le moment.
                    </p>
                  )}
                </section>
              )}
              <button className="back-link" onClick={() => openModule("")}>
                ← Retour à la vue d’ensemble
              </button>
            </>
          ) : (
            <>
              <section className="welcome-row">
                <div>
                  <p className="eyebrow">
                    JEUDI 25 SEPTEMBRE 2026 <span>·</span> SERVICE DU MIDI
                  </p>
                  <h1>
                    Bonjour {profileName.split(" ")[0]} <span>☀</span>
                  </h1>
                  <p className="welcome-copy">
                    Voici ce qui se passe dans votre établissement aujourd’hui.
                  </p>
                </div>
                <button
                  className="primary-button"
                  onClick={() => setModal("action")}
                >
                  <span>＋</span> Nouvelle action
                </button>
              </section>

              <section className="stats-grid" aria-label="Indicateurs du jour">
                <article className="stat-card revenue-card">
                  <div className="stat-heading">
                    <span>Chiffre d’affaires</span>
                    <span className="stat-icon">↗</span>
                  </div>
                  <div className="stat-value">
                    2 480 <small>€</small>
                  </div>
                  <div className="stat-foot">
                    <span className="trend">↗ 12,8 %</span>{" "}
                    <span>vs. jeudi dernier</span>
                    <div className="sparkline">
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>
                </article>
                <article className="stat-card">
                  <div className="stat-heading">
                    <span>Commandes en cours</span>
                    <span className="stat-icon soft-purple">⌂</span>
                  </div>
                  <div className="stat-value">
                    18 <small className="unit">commandes</small>
                  </div>
                  <div className="stat-foot">
                    <span className="foot-dot purple-dot" /> 6 en préparation{" "}
                    <span className="foot-separator">·</span> 12 servies
                  </div>
                </article>
                <article className="stat-card">
                  <div className="stat-heading">
                    <span>Équipe présente</span>
                    <span className="stat-icon soft-green">♧</span>
                  </div>
                  <div className="stat-value">
                    7 <small className="unit">/ 9 personnes</small>
                  </div>
                  <div className="stat-foot">
                    <span className="trend neutral">Prochaine arrivée</span>{" "}
                    <span>à 12 h 30</span>
                  </div>
                </article>
                <article className="stat-card">
                  <div className="stat-heading">
                    <span>Contrôles HACCP</span>
                    <span className="stat-icon soft-orange">✓</span>
                  </div>
                  <div className="stat-value">
                    92 <small className="unit">% complétés</small>
                  </div>
                  <div className="progress-track">
                    <span />
                  </div>
                  <div className="stat-foot">2 contrôles à effectuer</div>
                </article>
              </section>

              <div className="section-heading" id="modules">
                <div>
                  <p className="eyebrow">VOTRE RESTAURANT</p>
                  <h2>Tout est sous contrôle.</h2>
                </div>
                <button
                  className="text-link"
                  onClick={() => setModal("customize")}
                >
                  Personnaliser l’espace <span>↗</span>
                </button>
              </div>
              <section className="module-grid" aria-label="Modules Juliette">
                {visibleModules.map((module) => (
                  <a
                    href={`#${encodeURIComponent(module.name)}`}
                    onClick={(event) => {
                      event.preventDefault();
                      openModule(module.name);
                    }}
                    className="module-card"
                    key={module.name}
                  >
                    <div className={`module-icon ${module.color}`}>
                      {module.icon}
                    </div>
                    <div className="module-title-row">
                      <h3>{module.name}</h3>
                      <span className={`module-badge ${module.color}`}>
                        {module.badge}
                      </span>
                    </div>
                    <p>{module.detail}</p>
                    <span className="module-arrow">↗</span>
                  </a>
                ))}
              </section>

              <RecipeStockDemo
                onSale={() =>
                  addActivity(
                    "Vente enregistrée",
                    "Sauce tomate maison · stock déduit",
                    "✓",
                    "mint",
                  )
                }
              />

              <section className="lower-grid" id="activity">
                <article className="panel activity-panel">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">EN DIRECT</p>
                      <h2>Activité récente</h2>
                    </div>
                    <button
                      className="text-link"
                      onClick={() => openModule("Activité récente")}
                    >
                      Tout voir <span>↗</span>
                    </button>
                  </div>
                  <div className="activity-list">
                    {activities.slice(0, 3).map((item) => (
                      <div className="activity-row" key={item.id}>
                        <span className={`activity-icon ${item.tone}`}>
                          {item.icon}
                        </span>
                        <span className="activity-description">
                          <b>{item.title}</b>
                          <small>{item.note}</small>
                        </span>
                        <span className="activity-time">{item.time}</span>
                        <span className="activity-amount">{item.amount}</span>
                      </div>
                    ))}
                  </div>
                </article>
                <article className="panel focus-panel">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">À NE PAS OUBLIER</p>
                      <h2>Pour aujourd’hui</h2>
                    </div>
                    <span className="task-count">{tasksRemaining}</span>
                  </div>
                  {tasks.slice(0, 3).map((task) => (
                    <button
                      className="task-item task-button"
                      key={task.id}
                      onClick={() => toggleTask(task.id)}
                    >
                      <span className={`task-check ${task.done ? "done" : ""}`}>
                        {task.done ? "✓" : ""}
                      </span>
                      <span>
                        <b className={task.done ? "task-done" : ""}>
                          {task.title}
                        </b>
                        <small>{task.detail}</small>
                      </span>
                      {task.urgent && !task.done && (
                        <span className="task-priority">Urgent</span>
                      )}
                    </button>
                  ))}
                  <button
                    className="all-tasks"
                    onClick={() => openModule("Tâches")}
                  >
                    Voir mes tâches <span>→</span>
                  </button>
                </article>
              </section>

              <footer className="page-footer">
                <span>
                  Une bonne journée commence avec Juliette{" "}
                  <span className="footer-heart">♥</span>
                </span>
                <span>
                  Besoin d’aide ?{" "}
                  <a href="mailto:bonjour@juliette.app">On est là</a>
                </span>
              </footer>
            </>
          )}
        </div>
      </section>

      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModal(null);
          }}
        >
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
          >
            <button
              className="dialog-close"
              aria-label="Fermer"
              onClick={() => setModal(null)}
            >
              ×
            </button>
            {modal === "action" && (
              <>
                <p className="eyebrow">ESPACE DE TRAVAIL</p>
                <h2 id="dialog-title">Nouvelle action</h2>
                <p className="dialog-copy">
                  Ajoute une tâche ou une note à l’activité de l’établissement.
                </p>
                <form onSubmit={handleActionSubmit}>
                  <label>
                    Type
                    <select name="type">
                      <option>Tâche</option>
                      <option>Contrôle HACCP</option>
                      <option>Perte</option>
                      <option>Demande RH</option>
                      <option>Commande</option>
                    </select>
                  </label>
                  <label>
                    Titre
                    <input
                      name="title"
                      required
                      placeholder="Ex. Vérifier la livraison"
                      autoFocus
                    />
                  </label>
                  <label>
                    Détail
                    <input
                      name="detail"
                      placeholder="Échéance, produit ou personne concernée"
                    />
                  </label>
                  <div className="dialog-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setModal(null)}
                    >
                      Annuler
                    </button>
                    <button className="primary-button" type="submit">
                      Enregistrer
                    </button>
                  </div>
                </form>
              </>
            )}
            {modal === "add-record" && (
              <>
                <p className="eyebrow">{selectedModule.toUpperCase()}</p>
                <h2 id="dialog-title">Ajouter un élément</h2>
                <p className="dialog-copy">
                  L’élément sera enregistré dans ce navigateur et ajouté à
                  l’activité.
                </p>
                <form onSubmit={handleRecordSubmit}>
                  <label>
                    Nom ou description
                    <textarea
                      name="record"
                      required
                      placeholder={`Décrire l’élément à ajouter dans ${selectedModule}`}
                      autoFocus
                    />
                  </label>
                  <div className="dialog-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setModal(null)}
                    >
                      Annuler
                    </button>
                    <button className="primary-button" type="submit">
                      Ajouter
                    </button>
                  </div>
                </form>
              </>
            )}
            {modal === "profile" && (
              <>
                <p className="eyebrow">MON COMPTE</p>
                <h2 id="dialog-title">Modifier le profil</h2>
                <form onSubmit={handleProfileSubmit}>
                  <label>
                    Nom
                    <input
                      name="name"
                      defaultValue={profileName}
                      required
                      autoFocus
                    />
                  </label>
                  <label>
                    Statut
                    <input name="role" defaultValue={profileRole} required />
                  </label>
                  <div className="dialog-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setModal(null)}
                    >
                      Annuler
                    </button>
                    <button className="primary-button" type="submit">
                      Enregistrer
                    </button>
                  </div>
                </form>
              </>
            )}
            {modal === "customize" && (
              <>
                <p className="eyebrow">VOTRE ESPACE</p>
                <h2 id="dialog-title">Personnaliser l’espace</h2>
                <p className="dialog-copy">
                  Choisis les modules visibles sur la vue d’ensemble.
                </p>
                <form onSubmit={handleCustomizeSubmit}>
                  <div className="module-options">
                    {MODULES.map((module) => (
                      <label className="module-option" key={module.name}>
                        <input
                          type="checkbox"
                          name="module"
                          value={module.name}
                          defaultChecked={!hiddenModules.includes(module.name)}
                        />
                        <span>{module.icon}</span>
                        {module.name}
                      </label>
                    ))}
                  </div>
                  <div className="dialog-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setModal(null)}
                    >
                      Annuler
                    </button>
                    <button className="primary-button" type="submit">
                      Appliquer
                    </button>
                  </div>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
