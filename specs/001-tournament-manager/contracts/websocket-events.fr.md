# Événements WebSocket : Gestionnaire de Tournois de Fléchettes

**Généré** : 2026-02-03  
**But** : Contrats d’événements temps réel

## Connexion

### Rejoindre un tournoi
```javascript
// Connexion client
socket.emit('join_tournament', {
  tournament_id: 'uuid'
});

// Ack serveur
socket.on('tournament_joined', {
  tournament_id: 'uuid',
  current_status: 'in_progress',
  connected_clients: 5
});
```

## Événements tournoi

### Mise à jour score
**Déclencheur** : saisie de score via API REST  
**Direction** : Serveur → Clients

```javascript
socket.on('score_updated', {
  tournament_id: 'uuid',
  match_id: 'uuid',
  participant_1_score: 501,
  participant_2_score: 301,
  winner_id: 'uuid', // null si pas déterminé
  timestamp: '2026-02-03T14:30:00Z'
});
```

### Fin de match
**Déclencheur** : score final  
**Direction** : Serveur → Clients

```javascript
socket.on('match_completed', {
  tournament_id: 'uuid',
  match_id: 'uuid',
  winner_id: 'uuid',
  participant_1_final_score: 501,
  participant_2_final_score: 245,
  completed_at: '2026-02-03T14:30:00Z',
  next_matches: [
    {
      match_id: 'uuid',
      participants: ['player1_id', 'player2_id'],
      scheduled_time: '2026-02-03T14:35:00Z',
      target_number: 3
    }
  ]
});
```

### Changement disponibilité cible
**Déclencheur** : fin de match ou mise à jour cible  
**Direction** : Serveur → Clients

```javascript
socket.on('target_availability_changed', {
  tournament_id: 'uuid',
  target_updates: [
    {
      target_number: 1,
      availability_status: 'available', // 'occupied', 'maintenance'
      last_match_completed: '2026-02-03T14:30:00Z',
      next_match: {
        match_id: 'uuid',
        participants: ['player1_id', 'player2_id'],
        estimated_start: '2026-02-03T14:35:00Z'
      }
    }
  ]
});
```

### Mise à jour des classements
**Déclencheur** : score impactant le classement  
**Direction** : Serveur → Clients

```javascript
socket.on('standings_updated', {
  tournament_id: 'uuid',
  updated_at: '2026-02-03T14:30:00Z',
  pool_standings: [
    {
      pool_id: 'uuid',
      pool_number: 1,
      standings: [
        {
          participant_id: 'uuid',
          participant_name: 'John Doe',
          position: 1,
          matches_played: 3,
          matches_won: 2,
          points_for: 1403,
          points_against: 1201
        }
      ]
    }
  ],
  bracket_progression: [
    {
      bracket_id: 'uuid',
      bracket_type: 'winner',
      advanced_participants: ['uuid1', 'uuid2'],
      eliminated_participants: ['uuid3']
    }
  ]
});
```

### Prochain match assigné
**Déclencheur** : cible libre et match en file  
**Direction** : Serveur → Clients

```javascript
socket.on('next_match_assigned', {
  tournament_id: 'uuid',
  assignments: [
    {
      match_id: 'uuid',
      target_number: 2,
      participant_1: {
        id: 'uuid',
        name: 'Alice Smith',
        skill_level: 'advanced'
      },
      participant_2: {
        id: 'uuid',
        name: 'Bob Johnson',
        skill_level: 'intermediate'
      },
      estimated_start: '2026-02-03T14:35:00Z',
      match_type: 'pool', // ou 'bracket'
      stage_info: 'Pool A - Round 2'
    }
  ]
});
```

### Changement de statut du tournoi
**Déclencheur** : transition de phase  
**Direction** : Serveur → Clients

```javascript
socket.on('tournament_status_changed', {
  tournament_id: 'uuid',
  old_status: 'open',
  new_status: 'live',
  changed_at: '2026-02-03T14:00:00Z',
  message: 'Tournament has started - Pool stage beginning'
});
```

## Événements client

### Demander des updates live
**Direction** : Client → Serveur

```javascript
socket.emit('request_live_data', {
  tournament_id: 'uuid',
  data_types: ['standings', 'targets', 'next_matches']
});
```

### Heartbeat
**Direction** : bidirectionnel

```javascript
// Ping client
socket.emit('ping', { timestamp: Date.now() });

// Pong serveur
socket.on('pong', { timestamp: Date.now(), server_time: '2026-02-03T14:30:00Z' });
```

## Événements d’erreur

### Erreur tournoi
**Direction** : Serveur → Client

```javascript
socket.on('tournament_error', {
  tournament_id: 'uuid',
  error_type: 'invalid_score_entry',
  message: 'Score entry failed: Match already completed',
  match_id: 'uuid',
  timestamp: '2026-02-03T14:30:00Z'
});
```

### Erreur de connexion
**Direction** : Serveur → Client

```javascript
socket.on('connection_error', {
  error_type: 'tournament_not_found',
  message: 'Tournament ID does not exist or is finished',
  tournament_id: 'uuid'
});
```

## Ordonnancement & fiabilité

### Garantie de séquence
- Chaque événement inclut `tournament_id`
- Chaque événement inclut `timestamp`
- Les score updates précèdent les standings updates
- La fin de match précède la dispo cible

### Rate limiting
- 10 événements max par seconde et par client
- Batch d’événements similaires
- Debounce des standings (max 2s)

### Récupération d’erreurs
- Reconnexion client re-join auto
- Snapshot envoyé à la reconnexion
- Événements manquants récupérables via REST

## Notes d’implémentation

### Triggers côté serveur
```javascript
// Après saisie de score via REST
await updateMatch(matchId, scores);
io.to(`tournament_${tournamentId}`).emit('score_updated', eventData);
await recalculateStandings(tournamentId);
io.to(`tournament_${tournamentId}`).emit('standings_updated', standingsData);
```

### Gestion côté client
```javascript
// Intégration React
useEffect(() => {
  socket.on('score_updated', handleScoreUpdate);
  socket.on('standings_updated', handleStandingsUpdate);
  
  return () => {
    socket.off('score_updated', handleScoreUpdate);
    socket.off('standings_updated', handleStandingsUpdate);
  };
}, []);
```

### Considérations performance
- Rooms Socket.IO pour isoler les tournois
- Batch d’événements lors d’updates rapides
- Compression d’événements pour gros tournois
- Surveiller le nombre de clients (< 50 recommandé)
