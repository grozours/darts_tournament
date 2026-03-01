import { useI18n } from '../i18n';

type DocsAccountType = 'anonymous' | 'player' | 'admin';
type DocsUiLanguage = 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'nl';

type GuideStep = {
  text: string;
  screenshotKey:
    | 'doc-anonyme-vues'
    | 'doc-anonyme-inscrits'
    | 'doc-anonyme-connexion'
    | 'doc-joueur-simple'
    | 'doc-joueur-doublette'
    | 'doc-joueur-validation'
    | 'doc-admin-creation'
    | 'doc-admin-poules'
    | 'doc-admin-arbres'
    | 'doc-admin-leaderboard'
    | 'doc-admin-presets'
    | 'doc-admin-formats'
    | 'doc-admin-cibles';
  screenshotAlt: string;
  accessLink: { label: string; href: string };
};

type GuideContent = {
  label: string;
  title: string;
  steps: GuideStep[];
};

const DOCS_SCREENSHOT_VERSION = '20260301-admin-v2';

type DocsUiCopy = {
  tocTitle: string;
  stepLabel: string;
  backToTop: string;
};

const docsUiCopyByLanguage: Record<DocsUiLanguage, DocsUiCopy> = {
  fr: {
    tocTitle: 'Table des matières',
    stepLabel: 'Point',
    backToTop: 'Retour en haut',
  },
  en: {
    tocTitle: 'Table of contents',
    stepLabel: 'Step',
    backToTop: 'Back to top',
  },
  es: {
    tocTitle: 'Tabla de contenido',
    stepLabel: 'Paso',
    backToTop: 'Volver arriba',
  },
  de: {
    tocTitle: 'Inhaltsverzeichnis',
    stepLabel: 'Schritt',
    backToTop: 'Nach oben',
  },
  it: {
    tocTitle: 'Indice',
    stepLabel: 'Passo',
    backToTop: 'Torna su',
  },
  pt: {
    tocTitle: 'Índice',
    stepLabel: 'Passo',
    backToTop: 'Voltar ao topo',
  },
  nl: {
    tocTitle: 'Inhoudsopgave',
    stepLabel: 'Stap',
    backToTop: 'Terug naar boven',
  },
};

const resolveDocsUiLanguage = (lang: string): DocsUiLanguage => {
  if (lang === 'fr' || lang === 'en' || lang === 'es' || lang === 'de' || lang === 'it' || lang === 'pt' || lang === 'nl') {
    return lang;
  }
  return 'en';
};

const resolveStepScreenshotSource = (step: GuideStep, lang: DocsUiLanguage): string => {
  if (
    step.screenshotKey === 'doc-anonyme-vues'
    || step.screenshotKey === 'doc-anonyme-inscrits'
    || step.screenshotKey === 'doc-anonyme-connexion'
    || step.screenshotKey === 'doc-joueur-simple'
    || step.screenshotKey === 'doc-joueur-doublette'
    || step.screenshotKey === 'doc-joueur-validation'
    || step.screenshotKey === 'doc-admin-creation'
    || step.screenshotKey === 'doc-admin-poules'
    || step.screenshotKey === 'doc-admin-arbres'
    || step.screenshotKey === 'doc-admin-leaderboard'
    || step.screenshotKey === 'doc-admin-presets'
    || step.screenshotKey === 'doc-admin-formats'
    || step.screenshotKey === 'doc-admin-cibles'
  ) {
    return `/docs/screenshots/${step.screenshotKey}-${lang}.png?v=${DOCS_SCREENSHOT_VERSION}`;
  }
  return `/docs/screenshots/${step.screenshotKey}.png?v=${DOCS_SCREENSHOT_VERSION}`;
};

const buildGuideStepAnchorId = (accountType: DocsAccountType, index: number) => (
  `doc-${accountType}-step-${index + 1}`
);

const splitStepLines = (text: string) => text
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.length > 0);

const formatGuideStepAsYamlLike = (stepText: string, index: number) => {
  const lines = splitStepLines(stepText);
  const firstLine = lines[0] ?? '';
  const withoutIndex = firstLine.replace(/^\d+\.\s*/, '').trim();

  const separatorIndex = withoutIndex.indexOf(':');
  const hasTitle = separatorIndex > 0;
  const parsedTitle = hasTitle ? withoutIndex.slice(0, separatorIndex).trim() : '';
  const firstDescriptionChunk = hasTitle
    ? withoutIndex.slice(separatorIndex + 1).trim()
    : withoutIndex;

  const descriptionLines = [firstDescriptionChunk, ...lines.slice(1)].filter((line) => line.length > 0);

  const headerLine = parsedTitle
    ? `${index + 1} : ${parsedTitle}`
    : `${index + 1}`;

  const yamlLines: string[] = [headerLine];
  for (const line of descriptionLines) {
    yamlLines.push(`    ${line}`);
  }

  return yamlLines.join('\n');
};

const docsContent: Record<'fr' | 'en', {
  title: string;
  subtitle: string;
  guides: Record<DocsAccountType, GuideContent>;
}> = {
  fr: {
    title: 'Documentation rapide',
    subtitle: 'Explications simples selon ton type de compte.',
    guides: {
      anonymous: {
        label: 'Documentation anonyme',
        title: 'Découvrir les tournois sans compte',
        steps: [
          {
            text: '1. Consulte les tournois disponibles pour comprendre les formats et statuts.\nUtilise aussi les vues Live, Poules, Arbres et Cibles pour voir le déroulé global de la compétition.',
            screenshotKey: 'doc-anonyme-vues',
            screenshotAlt: 'Accès aux différentes vues publiques (tournois, live, poules, arbres, cibles)',
            accessLink: { label: 'Tournois', href: '/?status=OPEN' },
          },
          {
            text: '2. Ouvre les détails d’un tournoi pour consulter les inscrits.\nCette étape permet de vérifier le niveau de participation avant de te connecter.',
            screenshotKey: 'doc-anonyme-inscrits',
            screenshotAlt: 'Exemple de consultation des inscrits sur un tournoi',
            accessLink: { label: 'Inscriptions individuelles', href: '/?view=registration-players' },
          },
          {
            text: '3. Pour t’inscrire, commence par te connecter.\nChoisis ensuite le mode d’authentification disponible (Google, Facebook, Discord, etc.) pour finaliser ton accès.',
            screenshotKey: 'doc-anonyme-connexion',
            screenshotAlt: 'Étape de connexion avec les différents modes d’authentification',
            accessLink: { label: 'Se connecter', href: '/?view=account' },
          },
        ],
      },
      player: {
        label: 'Documentation joueur',
        title: 'S’inscrire en joueur et gérer son groupe',
        steps: [
          {
            text: '1. Identifie le format du tournoi avant de t’inscrire : simple, doublette ou équipe.\nLe parcours d’inscription n’est pas le même selon ce choix.',
            screenshotKey: 'doc-joueur-simple',
            screenshotAlt: 'Inscription joueur en format simple',
            accessLink: { label: 'Inscriptions individuelles', href: '/?view=registration-players' },
          },
          {
            text: '2. En doublette/équipe, le capitaine crée le groupe et définit le mot de passe.\nLes coéquipiers utilisent ce mot de passe pour rejoindre le bon groupe, ce qui évite les erreurs d’affectation.',
            screenshotKey: 'doc-joueur-doublette',
            screenshotAlt: 'Exemple de rôle capitaine et mot de passe en doublette/équipe',
            accessLink: { label: 'Doublettes', href: '/?view=doublettes' },
          },
          {
            text: '3. Valide le groupe uniquement lorsqu’il est complet : doublette=2, équipe=4.\nVérifie les profils présents puis confirme l’inscription pour passer le groupe en statut prêt.',
            screenshotKey: 'doc-joueur-validation',
            screenshotAlt: 'Validation d’une doublette/équipe complète',
            accessLink: { label: 'Équipes', href: '/?view=equipes' },
          },
        ],
      },
      admin: {
        label: 'Documentation admin',
        title: 'Piloter le tournoi en mode opérationnel',
        steps: [
          {
            text: '1. Utilise le menu Admin pour créer le tournoi et préparer sa configuration.\nTu définis ici les paramètres structurants avant ouverture des inscriptions.',
            screenshotKey: 'doc-admin-creation',
            screenshotAlt: 'Vue documentation admin',
            accessLink: { label: 'Créer un tournoi', href: '/?view=create-tournament' },
          },
          {
            text: '2. Vue Poules : sélectionne une poule pour suivre ses matchs, son classement et son avancement.\nLes boutons des cartes servent à lancer la phase, terminer automatiquement une phase, réinitialiser ou éditer la structure en fonction du besoin terrain.',
            screenshotKey: 'doc-admin-poules',
            screenshotAlt: 'Vue admin des poules avec cartes et actions de pilotage',
            accessLink: { label: 'Poules', href: '/?view=pool-stages' },
          },
          {
            text: '3. Vue Arbres : pilote la progression des tableaux à élimination.\nUtilise les actions pour compléter un tour, remettre un arbre à zéro si nécessaire, et contrôler le rythme de passage entre les tours.',
            screenshotKey: 'doc-admin-arbres',
            screenshotAlt: 'Vue admin des arbres avec actions de gestion de tour',
            accessLink: { label: 'Arbres', href: '/?view=brackets' },
          },
          {
            text: '4. Leaderboard des poules : le “+1” correspond à un bonus métier de départage.\nIl apparaît quand deux participants sont à égalité et que le résultat de leur confrontation directe donne un vainqueur à privilégier pour la qualification.',
            screenshotKey: 'doc-admin-leaderboard',
            screenshotAlt: 'Classement de poule avec bonus de départage +1',
            accessLink: { label: 'Classement poules', href: '/?view=pool-stages' },
          },
          {
            text: '5. Préréglages tournoi : définis une structure réutilisable (phases de poules, arbres, règles de qualification).\nLe preset encode le parcours métier des participants et évite de reconfigurer chaque tournoi manuellement.',
            screenshotKey: 'doc-admin-presets',
            screenshotAlt: 'Éditeur de préréglages de tournoi avec structure poules et arbres',
            accessLink: { label: 'Préréglages tournoi', href: '/?view=tournament-preset-editor' },
          },
          {
            text: '6. Formats de match : définis les segments (501, cricket, etc.) et la durée cible d’un match.\nCes formats garantissent une cohérence sportive entre poules et arbres et servent de référence aux arbitres.',
            screenshotKey: 'doc-admin-formats',
            screenshotAlt: 'Gestion des formats de match et de leurs segments',
            accessLink: { label: 'Formats de match', href: '/?view=match-formats' },
          },
          {
            text: '7. Vue Cibles : affecte un match à une cible, lance le match, saisis/ajuste le score, puis termine ou annule si incident.\nCette vue est le poste opérationnel pour fluidifier l’appel des joueurs et la remontée des résultats en temps réel.',
            screenshotKey: 'doc-admin-cibles',
            screenshotAlt: 'Vue cibles avec démarrage, saisie de score, clôture et annulation de match',
            accessLink: { label: 'Cibles', href: '/?view=targets' },
          },
        ],
      },
    },
  },
  en: {
    title: 'Quick documentation',
    subtitle: 'Very simple guidance based on your account type.',
    guides: {
      anonymous: {
        label: 'Anonymous documentation',
        title: 'Browse and join a tournament',
        steps: [
          {
            text: '1. Browse available tournaments to understand active formats and statuses.\nYou can also use Live, Pool, Brackets and Targets views for a global competition overview.',
            screenshotKey: 'doc-anonyme-vues',
            screenshotAlt: 'Anonymous documentation view',
            accessLink: { label: 'Open tournaments', href: '/?status=OPEN' },
          },
          {
            text: '2. Open tournament details to review currently registered participants.\nThis helps you evaluate participation before signing in.',
            screenshotKey: 'doc-anonyme-inscrits',
            screenshotAlt: 'Open tournaments list example',
            accessLink: { label: 'Singles registration', href: '/?view=registration-players' },
          },
          {
            text: '3. Sign in before registering.\nUse the available authentication provider (Google, Facebook, Discord, etc.) to complete access.',
            screenshotKey: 'doc-anonyme-connexion',
            screenshotAlt: 'Sign-in step to complete registration',
            accessLink: { label: 'Sign in', href: '/?view=account' },
          },
        ],
      },
      player: {
        label: 'Player documentation',
        title: 'Register and follow your matches',
        steps: [
          {
            text: '1. Start by selecting the tournament format: singles, doublette, or team.\nEach format has its own registration workflow.',
            screenshotKey: 'doc-joueur-simple',
            screenshotAlt: 'Player documentation view',
            accessLink: { label: 'Singles registration', href: '/?view=registration-players' },
          },
          {
            text: '2. In doublette/team mode, the captain creates the group and defines the password.\nTeammates use that password to join the exact group and avoid assignment errors.',
            screenshotKey: 'doc-joueur-doublette',
            screenshotAlt: 'Doublette join example',
            accessLink: { label: 'Doublettes', href: '/?view=doublettes' },
          },
          {
            text: '3. Validate the group only when complete: doublette=2, team=4.\nCheck members and confirm registration to mark the group ready for competition.',
            screenshotKey: 'doc-joueur-validation',
            screenshotAlt: 'Team tournament follow-up example',
            accessLink: { label: 'Teams', href: '/?view=equipes' },
          },
        ],
      },
      admin: {
        label: 'Admin documentation',
        title: 'Operate the tournament workflow',
        steps: [
          {
            text: '1. Use Admin menu to create the tournament and configure key settings.\nThis is the operational setup phase before registration opens.',
            screenshotKey: 'doc-admin-creation',
            screenshotAlt: 'Admin documentation view',
            accessLink: { label: 'Create tournament', href: '/?view=create-tournament' },
          },
          {
            text: '2. Pool view: select a pool to monitor matches, standings, and operational progress.\nCard actions are used to launch a stage, auto-complete a stage, reset, or edit structure depending on field constraints.',
            screenshotKey: 'doc-admin-poules',
            screenshotAlt: 'Admin pools view with card-level controls',
            accessLink: { label: 'Pools', href: '/?view=pool-stages' },
          },
          {
            text: '3. Bracket view: drive elimination progression round by round.\nUse controls to complete a round, reset a bracket when needed, and keep transition timing under control.',
            screenshotKey: 'doc-admin-arbres',
            screenshotAlt: 'Admin brackets view with round management actions',
            accessLink: { label: 'Brackets', href: '/?view=brackets' },
          },
          {
            text: '4. Pool leaderboard: “+1” is a business tie-break bonus.\nIt appears when two participants are tied and direct head-to-head result determines who should be prioritized for qualification.',
            screenshotKey: 'doc-admin-leaderboard',
            screenshotAlt: 'Pool leaderboard with +1 tie-break bonus',
            accessLink: { label: 'Pool standings', href: '/?view=pool-stages' },
          },
          {
            text: '5. Tournament presets: define reusable competition structures (pool stages, brackets, qualification routing).\nA preset captures your standard operational flow and avoids rebuilding setup each event.',
            screenshotKey: 'doc-admin-presets',
            screenshotAlt: 'Tournament preset editor with pools and brackets routing',
            accessLink: { label: 'Tournament presets', href: '/?view=tournament-preset-editor' },
          },
          {
            text: '6. Match formats: define segments (501, cricket, etc.) and target match duration.\nThese formats enforce sporting consistency across pools and brackets and provide a common referee baseline.',
            screenshotKey: 'doc-admin-formats',
            screenshotAlt: 'Match format management and segment configuration',
            accessLink: { label: 'Match formats', href: '/?view=match-formats' },
          },
          {
            text: '7. Targets view: assign a match to a target, start it, update scores, then complete or cancel in case of incident.\nThis is the operational console for smooth player calling and real-time result updates.',
            screenshotKey: 'doc-admin-cibles',
            screenshotAlt: 'Targets operations view with start, scoring, complete, and cancel actions',
            accessLink: { label: 'Targets', href: '/?view=targets' },
          },
        ],
      },
    },
  },
};

type DocsViewProperties = Readonly<{
  accountType?: DocsAccountType;
}>;

function DocsView({ accountType = 'anonymous' }: DocsViewProperties) {
  const { lang } = useI18n();
  const content = lang === 'fr' ? docsContent.fr : docsContent.en;
  const guide = content.guides[accountType];
  const docsUiLanguage = resolveDocsUiLanguage(lang);
  const docsUiCopy = docsUiCopyByLanguage[docsUiLanguage];
  const tocId = `doc-toc-${accountType}`;
  const tocStepLabel = (index: number) => `${docsUiCopy.stepLabel} ${index + 1}`;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">Doc</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">{content.title}</h2>
        <p className="mt-2 text-slate-300">{content.subtitle}</p>
      </div>

      <section className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-5">
        <h3 className="text-lg font-semibold text-white">{guide.title}</h3>

        <nav id={tocId} className="mt-3 rounded-xl border border-slate-800/70 bg-slate-900/30 p-3" aria-label={docsUiCopy.tocTitle}>
          <p className="text-xs uppercase tracking-widest text-slate-400">{docsUiCopy.tocTitle}</p>
          <ol className="mt-2 space-y-1 text-sm text-slate-300">
            {guide.steps.map((step, index) => {
              const anchorId = buildGuideStepAnchorId(accountType, index);
              return (
                <li key={`toc-${anchorId}`}>
                  <a href={`#${anchorId}`} className="text-cyan-300 hover:underline">
                    {tocStepLabel(index)} · {step.accessLink.label}
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>

        <ul className="mt-3 space-y-2 text-slate-300">
          {guide.steps.map((step, index) => {
            const anchorId = buildGuideStepAnchorId(accountType, index);
            return (
            <li id={anchorId} key={step.text} className="scroll-mt-28 rounded-xl border border-slate-800/70 bg-slate-900/30 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <pre className="flex-1 overflow-x-auto whitespace-pre-wrap rounded-lg border border-slate-800/70 bg-slate-950/40 p-3 font-mono text-xs leading-relaxed text-slate-200">
                  {formatGuideStepAsYamlLike(step.text, index)}
                </pre>
                <a
                  href={step.accessLink.href}
                  className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-cyan-300 hover:bg-slate-800"
                >
                  {step.accessLink.label}
                </a>
              </div>
              <figure className="mt-3 overflow-hidden rounded-lg border border-slate-800/70 bg-slate-900/40">
                <img
                  src={resolveStepScreenshotSource(step, docsUiLanguage)}
                  alt={step.screenshotAlt}
                  className="h-auto w-full object-cover"
                  loading="lazy"
                />
                <figcaption className="px-3 py-2 text-xs text-slate-300">{step.screenshotAlt}</figcaption>
              </figure>
              <div className="mt-3 flex justify-end">
                <a href={`#${tocId}`} className="text-xs text-cyan-300 hover:underline">
                  {docsUiCopy.backToTop}
                </a>
              </div>
            </li>
          );})}
        </ul>
      </section>

    </div>
  );
}

export default DocsView;
