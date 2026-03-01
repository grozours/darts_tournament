# Architectuur

Architectuuroverzicht van de dartstoernooi-applicatie.

## Componenten
- Frontend: React + TypeScript
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL + Prisma
- Realtime: Socket.IO

## Functionele lagen
- Presentatie: rolgebaseerde weergaven (anoniem, speler, admin).
- Applicatie: businesslogica (inschrijving, groepen, progressie).
- Infrastructuur: opslag, cache, sockets, observability.

## Hoofdflows
- Optionele authenticatie met controle van admin-rol.
- Beheer van toernooien, poulefases, brackets en targets.
- Live-updates en meldingen.

## Gerelateerde documenten
- API: [API.nl.md](./API.nl.md)
- Commando's: [COMMANDS.nl.md](./COMMANDS.nl.md)
- Admin-gids: [ADMIN_GUIDE.nl.md](./ADMIN_GUIDE.nl.md)

## Volledige referentie
- EN: [ARCHITECTURE](./ARCHITECTURE.md)
- FR: [ARCHITECTURE](./ARCHITECTURE.fr.md)
