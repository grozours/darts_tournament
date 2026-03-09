import { useEffect } from 'react';

const REPOSITORY_URL = 'https://github.com/grozours/darts_tournament';

const ensureMetaDescription = (content: string) => {
  if (!globalThis.document) {
    return;
  }

  let descriptionTag = globalThis.document.querySelector('meta[name="description"]');
  if (!descriptionTag) {
    descriptionTag = globalThis.document.createElement('meta');
    descriptionTag.setAttribute('name', 'description');
    globalThis.document.head.appendChild(descriptionTag);
  }
  descriptionTag.setAttribute('content', content);
};

const OpenSourceView = () => {
  useEffect(() => {
    const previousTitle = globalThis.document?.title;
    const previousDescription = globalThis.document
      ?.querySelector('meta[name="description"]')
      ?.getAttribute('content');

    if (globalThis.document) {
      globalThis.document.title = 'Darts Tournament GitHub Project';
    }

    ensureMetaDescription(
      'Open source darts tournament manager project with frontend and backend code, releases, docs, and contribution guide.'
    );

    return () => {
      if (!globalThis.document) {
        return;
      }
      if (previousTitle) {
        globalThis.document.title = previousTitle;
      }
      if (typeof previousDescription === 'string') {
        ensureMetaDescription(previousDescription);
      }
    };
  }, []);

  return (
    <section className="mx-auto max-w-4xl space-y-5 rounded-2xl border border-slate-800/70 bg-slate-950/40 p-6 text-slate-200">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-white">Darts Tournament GitHub</h1>
        <p className="text-sm text-slate-300">
          This page helps search engines discover the public GitHub repository and key project resources.
        </p>
      </header>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <p className="text-sm text-slate-300">Repository URL</p>
        <a
          href={REPOSITORY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center rounded-md border border-cyan-500/60 px-3 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/10"
        >
          {REPOSITORY_URL}
        </a>
      </div>

      <div className="space-y-2 text-sm text-slate-300">
        <p>
          If you are looking for source code, releases, issues, or contribution guidelines, use the repository link above.
        </p>
        <p>
          Project website: <a className="text-cyan-300 hover:text-cyan-200" href="https://darts.bzhtech.eu">https://darts.bzhtech.eu</a>
        </p>
      </div>
    </section>
  );
};

export default OpenSourceView;
