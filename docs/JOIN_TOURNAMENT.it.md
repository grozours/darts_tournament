# Partecipa a un torneo (giocatore/amministratore)

Questa guida copre i flussi di registrazione per:
- separare
- doppietto
- squadra

## Accesso
- Nell'app: collegamento `Doc` nell'intestazione.
- Viste utili:
- `/?view=registration-players`
- `/?view=doublettes&tournamentId=<tournament-id>`
- `/?view=equipes&tournamentId=<tournament-id>`

---

##1) Torneo singolo

### Giocatore
1. Apri la vista `Registration`.
2. Vai a **Tornei singoli**.
3. Conferma che la tua registrazione venga visualizzata nell'elenco dei giocatori.

### Ammin
1. Apri la vista `Registration`.
2. Controlla i partecipanti ai **Tornei singoli**.
3. Completa le registrazioni mancanti prima del lancio.

![Join single tournament](assets/screenshots/rejoindre-tournoi-simple.png)

---

##2) Torneo di doppiette

### Giocatore
1. Apri `Doublettes` per il torneo selezionato.
2. Fare clic su **Unisci** su un doublette aperto.
3. Immettere la password doppietta.
4. Conferma che il tuo nome venga visualizzato tra i membri.

### Ammin
1. Apri `Doublettes` per il torneo.
2. Verifica la composizione (membri, capitano, stato di iscrizione).
3. Convalidare i doublette completi e registrati.

![Join doublette](assets/screenshots/rejoindre-tournoi-doublette.png)

---

##3) Torneo a squadre

### Giocatore
1. Apri `Equipes` per il torneo selezionato.
2. Fai clic su **Partecipa** in un team aperto.
3. Inserisci la password della squadra.
4. Conferma che il tuo nome venga visualizzato nell'elenco.

### Ammin
1. Apri `Equipes` per il torneo.
2. Controlla il roster, il capitano e lo stato di registrazione.
3. Finalizzare le squadre complete prima dell'inizio.

![Join team](assets/screenshots/rejoindre-tournoi-equipe.png)

---

##4) Iscrizione squadra da tessera torneo

### Giocatore
1. Apri la visualizzazione principale del torneo (`/?status=OPEN`).
2. Se non hai una squadra in questo torneo, fai clic su **Crea la mia squadra**.
3. Una volta completata la tua squadra (4 giocatori), torna alla scheda del torneo.
4. Fare clic su **Registrati** per registrare la squadra al torneo.

### Ammin
1. Verificare che le carte della squadra mostrino le azioni previste a seconda dello stato del giocatore/gruppo.
2. Verificare che le squadre incomplete non possano essere registrate dalla tessera.

![Team registration from tournament card](assets/screenshots/inscription-equipe-carte.png)

---

## 5) Gestisci la tua squadra

### Giocatore (capitano)
1. Apri la visualizzazione `Equipes` del torneo (`/?view=equipes&tournamentId=<tournament-id>`).
2. Gestisci il tuo team con le azioni disponibili: **Modifica**, **Registra gruppo**, **Lascia**, **Password**.
3. Verifica i membri e lo stato del gruppo prima della registrazione.

### Ammin
1. Esamina la composizione di ogni squadra e lo stato di registrazione.
2. Intervenire se necessario utilizzando azioni di amministrazione.

![Manage your team](assets/screenshots/gerer-equipe-actions.png)

---

## Promemoria dominio
- **Single**: ingresso individuale.
- **Doublette**: gruppo da 2 giocatori.
- **Squadra**: gruppo da 4 giocatori.
- La registrazione è operativa quando il giocatore/gruppo è completo e registrato.
