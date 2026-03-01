# Architettura

Panoramica architetturale dell’applicazione torneo freccette.

## Componenti
- Frontend: React + TypeScript
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL + Prisma
- Realtime: Socket.IO

## Livelli funzionali
- Presentazione: viste per ruolo (anonimo, giocatore, admin).
- Applicazione: logica di business (iscrizioni, gruppi, progressione).
- Infrastruttura: persistenza, cache, socket, osservabilità.

## Flussi principali
- Autenticazione opzionale con controllo ruolo admin.
- Gestione tornei, fasi a gironi, tabelloni e bersagli.
- Aggiornamenti live e notifiche.

## Documenti correlati
- API: [API.it.md](./API.it.md)
- Comandi: [COMMANDS.it.md](./COMMANDS.it.md)
- Guida admin: [ADMIN_GUIDE.it.md](./ADMIN_GUIDE.it.md)

## Riferimento completo
- EN: [ARCHITECTURE](./ARCHITECTURE.md)
- FR: [ARCHITECTURE](./ARCHITECTURE.fr.md)
