# Architektur

Architekturüberblick der Dart-Turnieranwendung.

## Komponenten
- Frontend: React + TypeScript
- Backend: Node.js + Express + TypeScript
- Datenbank: PostgreSQL + Prisma
- Echtzeit: Socket.IO

## Funktionale Schichten
- Präsentation: rollenbasierte Ansichten (anonym, Spieler, Admin).
- Anwendung: Geschäftslogik (Registrierung, Gruppen, Progression).
- Infrastruktur: Persistenz, Cache, Sockets, Monitoring.

## Hauptflüsse
- Optionale Authentifizierung mit Admin-Rollenprüfung.
- Verwaltung von Turnieren, Gruppenphasen, Brackets und Targets.
- Live-Updates und Benachrichtigungen.

## Ergänzende Dokumente
- API: [API.de.md](./API.de.md)
- Befehle: [COMMANDS.de.md](./COMMANDS.de.md)
- Admin-Leitfaden: [ADMIN_GUIDE.de.md](./ADMIN_GUIDE.de.md)

## Vollständige Referenz
- EN: [ARCHITECTURE](./ARCHITECTURE.md)
- FR: [ARCHITECTURE](./ARCHITECTURE.fr.md)
