# Arquitectura

Resumen arquitectónico de la aplicación de torneos de dardos.

## Componentes
- Frontend: React + TypeScript
- Backend: Node.js + Express + TypeScript
- Base de datos: PostgreSQL + Prisma
- Tiempo real: Socket.IO

## Capas funcionales
- Presentación: vistas por rol (anónimo, jugador, admin).
- Aplicación: reglas de negocio (inscripción, grupos, progresión).
- Infraestructura: persistencia, caché, sockets, observabilidad.

## Flujos críticos
- Creación y configuración de torneo.
- Inscripción y validación de grupos.
- Ejecución de fases de grupos y cuadros.
- Operación en vivo por diana y actualización de resultados.

## Flujos principales
- Autenticación opcional con control de rol admin.
- Gestión de torneos, fases de grupos, cuadros y dianas.
- Actualizaciones en vivo y notificaciones.

## Documentos complementarios
- API: [API.es.md](./API.es.md)
- Comandos: [COMMANDS.es.md](./COMMANDS.es.md)
- Guía admin: [ADMIN_GUIDE.es.md](./ADMIN_GUIDE.es.md)

## Referencia completa
- EN: [ARCHITECTURE](./ARCHITECTURE.md)
- FR: [ARCHITECTURE](./ARCHITECTURE.fr.md)
