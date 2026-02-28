import { useI18n } from '../i18n';

const docsContent: Record<'fr' | 'en', {
  title: string;
  subtitle: string;
  stepsTitle: string;
  steps: string[];
  rolesTitle: string;
  roles: string[];
  tipsTitle: string;
  tips: string[];
}> = {
  fr: {
    title: 'Guide tournoi de fléchettes',
    subtitle: 'Repères métier pour gérer un tournoi, des inscriptions au classement final.',
    stepsTitle: 'Parcours tournoi',
    steps: [
      '1. Créer le tournoi (format, date, lieu, cibles).',
      '2. Ouvrir les inscriptions et enregistrer joueurs, doublettes ou équipes.',
      '3. Valider les engagés puis lancer la compétition.',
      '4. Piloter les matchs en poules et/ou tableaux sur les cibles.',
      '5. Saisir les scores, clôturer les matchs et publier le classement final.',
    ],
    rolesTitle: 'Rôles',
    roles: [
      'Organisateur (admin) : paramétrage, arbitrage, lancement et clôture du tournoi.',
      'Joueur : inscription, suivi des convocations et consultation des résultats.',
    ],
    tipsTitle: 'Repères',
    tips: [
      'Vue Live : suivi des poules, tableaux et files de match.',
      'Vue Cibles : affectation cible, démarrage, fin et annulation d’un match.',
      'Notifications : convocations au pas de tir et changements de format.',
    ],
  },
  en: {
    title: 'Darts Tournament Guide',
    subtitle: 'Business flow from registration to final standings.',
    stepsTitle: 'Tournament flow',
    steps: [
      '1. Create the tournament (format, date, venue, targets).',
      '2. Open registration and add players, doublettes, or teams.',
      '3. Validate entrants and start competition.',
      '4. Run pool-stage and/or bracket matches on targets.',
      '5. Enter scores, close matches, and publish final standings.',
    ],
    rolesTitle: 'Roles',
    roles: [
      'Organizer (admin): setup, officiating, launch, and close the tournament.',
      'Player: register, follow match calls, and check results.',
    ],
    tipsTitle: 'Tips',
    tips: [
      'Live view: monitor pool stages, brackets, and match queues.',
      'Targets view: assign target, start, finish, or cancel a match.',
      'Notifications: match calls and format updates.',
    ],
  },
};

function DocsView() {
  const { lang } = useI18n();
  const content = lang === 'fr' ? docsContent.fr : docsContent.en;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">Doc</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">{content.title}</h2>
        <p className="mt-2 text-slate-300">{content.subtitle}</p>
      </div>

      <section className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-5">
        <h3 className="text-lg font-semibold text-white">{content.stepsTitle}</h3>
        <ul className="mt-3 space-y-2 text-slate-300">
          {content.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-5">
        <h3 className="text-lg font-semibold text-white">{content.rolesTitle}</h3>
        <ul className="mt-3 space-y-2 text-slate-300">
          {content.roles.map((role) => (
            <li key={role}>{role}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-5">
        <h3 className="text-lg font-semibold text-white">{content.tipsTitle}</h3>
        <ul className="mt-3 space-y-2 text-slate-300">
          {content.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default DocsView;
