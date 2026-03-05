#!/usr/bin/env node

import { performance } from 'node:perf_hooks';
import process from 'node:process';

const DEFAULT_BASE_URL = 'https://darts.bzhtech.eu';
const DEFAULT_PATHS = [
  '/',
  '/?status=OPEN',
  '/?status=live',
  '/?view=pool-stages',
  '/?view=brackets',
  '/?view=targets',
  '/?status=FINISHED',
  '/?view=doc',
  '/?view=account',
  '/?view=doublettes',
  '/?view=equipes',
];

const HELP_TEXT = `
Simulation de trafic anonyme (HTTP) sur plusieurs vues de l'application.

Usage:
  node scripts/simulate_anonymous_traffic.mjs --visitors 50 [options]

Options:
  --url <baseUrl>            URL de base (défaut: ${DEFAULT_BASE_URL})
  --visitors <nombre>        Nombre de visiteurs anonymes concurrents (obligatoire)
  --duration <secondes>      Durée de la simulation (défaut: 60)
  --min-think <ms>           Pause minimale entre 2 pages / visiteur (défaut: 300)
  --max-think <ms>           Pause maximale entre 2 pages / visiteur (défaut: 1800)
  --timeout <ms>             Timeout d'une requête HTTP (défaut: 10000)
  --progress-every <sec>     Fréquence d'affichage de progression (défaut: 5)
  --paths <liste>            Liste CSV de chemins à visiter
                             Ex: --paths "/,/?status=OPEN,/?view=targets"
  --help                     Affiche cette aide

Exemple:
  node scripts/simulate_anonymous_traffic.mjs \
    --url https://darts.bzhtech.eu \
    --visitors 120 \
    --duration 180 \
    --min-think 200 \
    --max-think 1200
`;

if (typeof globalThis.fetch !== 'function') {
  console.error('Fetch global indisponible. Utilise Node.js 18+ pour exécuter ce script.');
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const pickRandom = (items) => items[Math.floor(Math.random() * items.length)];

const randomIntInclusive = (min, max) => {
  if (min === max) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const incrementMap = (map, key) => {
  map.set(key, (map.get(key) ?? 0) + 1);
};

const parseArgs = (argv) => {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--help' || token === '-h') {
      parsed.help = true;
      continue;
    }

    if (!token.startsWith('--')) {
      throw new Error(`Argument invalide: ${token}`);
    }

    const equalIndex = token.indexOf('=');
    const key = token.slice(2, equalIndex === -1 ? undefined : equalIndex);
    let value = equalIndex === -1 ? undefined : token.slice(equalIndex + 1);

    if (!value) {
      const nextToken = argv[index + 1];
      if (!nextToken || nextToken.startsWith('--')) {
        throw new Error(`Valeur manquante pour --${key}`);
      }
      value = nextToken;
      index += 1;
    }

    parsed[key] = value;
  }

  return parsed;
};

const parseNumberOption = (rawValue, label, { min, integer = false }) => {
  const value = Number(rawValue);

  if (!Number.isFinite(value)) {
    throw new Error(`Option ${label} invalide: ${rawValue}`);
  }

  if (integer && !Number.isInteger(value)) {
    throw new Error(`Option ${label} doit être un entier: ${rawValue}`);
  }

  if (value < min) {
    throw new Error(`Option ${label} doit être >= ${min}. Reçu: ${rawValue}`);
  }

  return value;
};

const buildConfig = (options) => {
  if (options.help) {
    return { help: true };
  }

  const visitorsRaw = options.visitors;
  if (!visitorsRaw) {
    throw new Error('Option obligatoire manquante: --visitors');
  }

  const baseUrl = options.url ?? DEFAULT_BASE_URL;
  let normalizedBaseUrl;
  try {
    normalizedBaseUrl = new URL(baseUrl).toString();
  } catch {
    throw new Error(`URL invalide: ${baseUrl}`);
  }

  const visitors = parseNumberOption(visitorsRaw, '--visitors', { min: 1, integer: true });
  const durationSec = parseNumberOption(options.duration ?? '60', '--duration', { min: 1 });
  const minThinkMs = parseNumberOption(options['min-think'] ?? '300', '--min-think', { min: 0, integer: true });
  const maxThinkMs = parseNumberOption(options['max-think'] ?? '1800', '--max-think', { min: 0, integer: true });
  const timeoutMs = parseNumberOption(options.timeout ?? '10000', '--timeout', { min: 1, integer: true });
  const progressEverySec = parseNumberOption(options['progress-every'] ?? '5', '--progress-every', { min: 1, integer: true });

  if (minThinkMs > maxThinkMs) {
    throw new Error('--min-think doit être <= --max-think');
  }

  const paths = (options.paths
    ? options.paths.split(',').map((item) => item.trim()).filter(Boolean)
    : DEFAULT_PATHS);

  if (paths.length === 0) {
    throw new Error('Aucun chemin à visiter. Utilise --paths ou la liste par défaut.');
  }

  for (const path of paths) {
    try {
      new URL(path, normalizedBaseUrl);
    } catch {
      throw new Error(`Chemin invalide: ${path}`);
    }
  }

  return {
    help: false,
    baseUrl: normalizedBaseUrl,
    visitors,
    durationSec,
    minThinkMs,
    maxThinkMs,
    timeoutMs,
    progressEverySec,
    paths,
  };
};

const nowAsIso = () => new Date().toISOString();

const formatDuration = (seconds) => {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${minutes}m${String(remaining).padStart(2, '0')}s`;
};

const printMap = (title, map) => {
  console.log(title);
  if (map.size === 0) {
    console.log('  (aucun)');
    return;
  }

  const rows = [...map.entries()].sort((left, right) => right[1] - left[1]);
  for (const [key, count] of rows) {
    console.log(`  ${key}: ${count}`);
  }
};

const options = parseArgs(process.argv.slice(2));
const config = buildConfig(options);

if (config.help) {
  console.log(HELP_TEXT.trim());
  process.exit(0);
}

const stats = {
  startedAtMs: Date.now(),
  attempts: 0,
  responses: 0,
  successResponses: 0,
  failedResponses: 0,
  networkErrors: 0,
  latencyTotalMs: 0,
  latencyMinMs: Number.POSITIVE_INFINITY,
  latencyMaxMs: 0,
  statusCounts: new Map(),
  errorCounts: new Map(),
};

const simulationEndsAtMs = Date.now() + Math.round(config.durationSec * 1000);

const recordResponse = (statusCode, latencyMs) => {
  stats.attempts += 1;
  stats.responses += 1;
  stats.latencyTotalMs += latencyMs;
  stats.latencyMinMs = Math.min(stats.latencyMinMs, latencyMs);
  stats.latencyMaxMs = Math.max(stats.latencyMaxMs, latencyMs);
  incrementMap(stats.statusCounts, statusCode);

  if (statusCode >= 200 && statusCode < 400) {
    stats.successResponses += 1;
  } else {
    stats.failedResponses += 1;
  }
};

const recordError = (errorName) => {
  stats.attempts += 1;
  stats.networkErrors += 1;
  incrementMap(stats.errorCounts, errorName);
};

const buildVisitorHeaders = (visitorId) => ({
  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': pickRandom(['fr-FR,fr;q=0.9', 'en-US,en;q=0.8']),
  'cache-control': 'no-cache',
  'pragma': 'no-cache',
  'user-agent': `darts-anon-traffic-simulator/1.0 visitor-${visitorId}`,
  'x-traffic-simulator': 'anonymous',
  'x-visitor-id': `anon-${visitorId}`,
});

const runVisitor = async (visitorId) => {
  const headers = buildVisitorHeaders(visitorId);

  while (Date.now() < simulationEndsAtMs) {
    const path = pickRandom(config.paths);
    const targetUrl = new URL(path, config.baseUrl).toString();
    const requestStartedAt = performance.now();

    const abortController = new AbortController();
    const timeoutHandle = setTimeout(() => abortController.abort(), config.timeoutMs);

    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers,
        redirect: 'follow',
        signal: abortController.signal,
      });
      await response.arrayBuffer();
      const latencyMs = performance.now() - requestStartedAt;
      recordResponse(response.status, latencyMs);
    } catch (error) {
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      recordError(errorName);
    } finally {
      clearTimeout(timeoutHandle);
    }

    if (Date.now() >= simulationEndsAtMs) {
      break;
    }

    const thinkTime = randomIntInclusive(config.minThinkMs, config.maxThinkMs);
    await sleep(thinkTime);
  }
};

const printProgress = () => {
  const elapsedSec = (Date.now() - stats.startedAtMs) / 1000;
  const requestsPerSecond = elapsedSec > 0 ? stats.attempts / elapsedSec : 0;
  const averageLatency = stats.responses > 0 ? (stats.latencyTotalMs / stats.responses) : 0;

  console.log(
    `[${nowAsIso()}] attempts=${stats.attempts} ok=${stats.successResponses} httpErr=${stats.failedResponses} netErr=${stats.networkErrors} rps=${requestsPerSecond.toFixed(2)} avg=${averageLatency.toFixed(1)}ms`
  );
};

const progressInterval = setInterval(printProgress, config.progressEverySec * 1000);
progressInterval.unref();

console.log(`[${nowAsIso()}] Démarrage simulation anonyme`);
console.log(`- baseUrl: ${config.baseUrl}`);
console.log(`- visiteurs: ${config.visitors}`);
console.log(`- durée: ${formatDuration(config.durationSec)}`);
console.log(`- thinkTime: ${config.minThinkMs}-${config.maxThinkMs} ms`);
console.log(`- timeout: ${config.timeoutMs} ms`);
console.log(`- vues (${config.paths.length}): ${config.paths.join(', ')}`);

await Promise.all(
  Array.from({ length: config.visitors }, (_, index) => runVisitor(index + 1))
);

clearInterval(progressInterval);

const elapsedSec = (Date.now() - stats.startedAtMs) / 1000;
const rps = elapsedSec > 0 ? stats.attempts / elapsedSec : 0;
const avgLatency = stats.responses > 0 ? stats.latencyTotalMs / stats.responses : 0;
const minLatency = Number.isFinite(stats.latencyMinMs) ? stats.latencyMinMs : 0;
const successRate = stats.attempts > 0
  ? (stats.successResponses / stats.attempts) * 100
  : 0;

console.log(`\n[${nowAsIso()}] Fin simulation`);
console.log(`- durée réelle: ${formatDuration(elapsedSec)}`);
console.log(`- tentatives totales: ${stats.attempts}`);
console.log(`- réponses HTTP: ${stats.responses}`);
console.log(`- succès HTTP (2xx/3xx): ${stats.successResponses}`);
console.log(`- erreurs HTTP (4xx/5xx): ${stats.failedResponses}`);
console.log(`- erreurs réseau/timeouts: ${stats.networkErrors}`);
console.log(`- taux de succès global: ${successRate.toFixed(2)}%`);
console.log(`- débit moyen: ${rps.toFixed(2)} req/s`);
console.log(`- latence moyenne: ${avgLatency.toFixed(1)} ms`);
console.log(`- latence min/max: ${minLatency.toFixed(1)} / ${stats.latencyMaxMs.toFixed(1)} ms`);

printMap('- codes HTTP:', stats.statusCounts);
printMap('- erreurs réseau:', stats.errorCounts);
