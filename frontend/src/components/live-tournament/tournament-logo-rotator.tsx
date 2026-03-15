import { useEffect, useMemo, useState } from 'react';

type TournamentLogoRotatorProperties = {
  tournamentName: string;
  logoUrls?: string[];
  className?: string;
};

const LOGO_ROTATION_INTERVAL_MS = 5_000;

const normalizeLogoUrls = (logoUrls: string[] | undefined): string[] => {
  if (!logoUrls || logoUrls.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const entry of logoUrls) {
    const value = entry.trim();
    if (value.length === 0 || seen.has(value)) {
      continue;
    }

    seen.add(value);
    normalized.push(value);
  }

  return normalized;
};

const TournamentLogoRotator = ({
  tournamentName,
  logoUrls,
  className,
}: TournamentLogoRotatorProperties) => {
  const normalizedLogoUrls = useMemo(() => normalizeLogoUrls(logoUrls), [logoUrls]);
  const rotationKey = normalizedLogoUrls.join('|');
  const [logoIndex, setLogoIndex] = useState(0);

  useEffect(() => {
    setLogoIndex(0);
  }, [rotationKey]);

  useEffect(() => {
    const logosCount = normalizedLogoUrls.length;
    if (logosCount <= 1) {
      return undefined;
    }

    const intervalId = globalThis.setInterval(() => {
      setLogoIndex((currentIndex) => (currentIndex + 1) % logosCount);
    }, LOGO_ROTATION_INTERVAL_MS);

    return () => {
      globalThis.clearInterval(intervalId);
    };
  }, [rotationKey, normalizedLogoUrls.length]);

  if (normalizedLogoUrls.length === 0) {
    return null;
  }

  const src = normalizedLogoUrls[logoIndex] ?? normalizedLogoUrls[0];
  if (!src) {
    return null;
  }

  return (
    <img
      src={src}
      alt={`${tournamentName} logo`}
      className={className ?? 'h-10 w-10 rounded-lg border border-slate-700/70 bg-slate-950/60 object-contain p-1'}
      loading="lazy"
    />
  );
};

export default TournamentLogoRotator;
