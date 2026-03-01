# Arquitetura

Visão geral da arquitetura da aplicação de torneios de dardos.

## Componentes
- Frontend: React + TypeScript
- Backend: Node.js + Express + TypeScript
- Base de dados: PostgreSQL + Prisma
- Tempo real: Socket.IO

## Camadas funcionais
- Apresentação: vistas por perfil (anónimo, jogador, admin).
- Aplicação: regras de negócio (inscrição, grupos, progressão).
- Infraestrutura: persistência, cache, sockets, observabilidade.

## Fluxos principais
- Autenticação opcional com verificação de papel admin.
- Gestão de torneios, fases de grupos, brackets e alvos.
- Atualizações em direto e notificações.

## Documentos relacionados
- API: [API.pt.md](./API.pt.md)
- Comandos: [COMMANDS.pt.md](./COMMANDS.pt.md)
- Guia admin: [ADMIN_GUIDE.pt.md](./ADMIN_GUIDE.pt.md)

## Referência completa
- EN: [ARCHITECTURE](./ARCHITECTURE.md)
- FR: [ARCHITECTURE](./ARCHITECTURE.fr.md)
