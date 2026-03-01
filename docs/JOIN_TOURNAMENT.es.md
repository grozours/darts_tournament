# Unirse a un torneo (jugador/administrador)

Esta guía cubre los flujos de registro para:
- soltero
- doblete
- equipo

## Acceso
- En la aplicación: enlace `Doc` en el encabezado.
- Vistas útiles:
- `/?view=registration-players`
- `/?view=doublettes&tournamentId=<tournament-id>`
- `/?view=equipes&tournamentId=<tournament-id>`

---

## 1) Torneo individual

### Jugador
1. Abra la vista `Registration`.
2. Ve a **Torneos individuales**.
3. Confirma que tu registro aparece en la lista de jugadores.

### Administrador
1. Abra la vista `Registration`.
2. Revisa los participantes en **Torneos individuales**.
3. Complete los registros faltantes antes del lanzamiento.

![Join single tournament](assets/screenshots/rejoindre-tournoi-simple.png)

---

## 2) Torneo de doblete

### Jugador
1. Abra `Doublettes` para el torneo seleccionado.
2. Haga clic en **Unirse** en un doblete abierto.
3. Ingrese la contraseña del doblete.
4. Confirma que tu nombre aparece en miembros.

### Administrador
1. Abra `Doublettes` para el torneo.
2. Verificar composición (miembros, capitán, estado de registro).
3. Validar dobletes completos y registrados.

![Join doublette](assets/screenshots/rejoindre-tournoi-doublette.png)

---

## 3) Torneo por equipos

### Jugador
1. Abra `Equipes` para el torneo seleccionado.
2. Haga clic en **Unirse** en un equipo abierto.
3. Ingrese la contraseña del equipo.
4. Confirme que su nombre aparezca en la lista.

### Administrador
1. Abra `Equipes` para el torneo.
2. Verifique la lista, el capitán y el estado de registro.
3. Finalizar equipos completos antes de comenzar.

![Join team](assets/screenshots/rejoindre-tournoi-equipe.png)

---

## 4) Registro del equipo desde la tarjeta del torneo

### Jugador
1. Abra la vista principal del torneo (`/?status=OPEN`).
2. Si no tienes un equipo en este torneo, haz clic en **Crear mi equipo**.
3. Una vez que tu equipo esté completo (4 jugadores), regresa a la tarjeta del torneo.
4. Haga clic en **Registrarse** para registrar el equipo en el torneo.

### Administrador
1. Verifique que las tarjetas del equipo muestren las acciones esperadas según el estado del jugador/grupo.
2. Verificar que los equipos incompletos no puedan registrarse desde la tarjeta.

![Team registration from tournament card](assets/screenshots/inscription-equipe-carte.png)

---

## 5) Gestiona tu equipo

### Jugador (capitán)
1. Abra la vista `Equipes` para el torneo (`/?view=equipes&tournamentId=<tournament-id>`).
2. Administre su equipo con acciones disponibles: **Editar**, **Registrar grupo**, **Salir**, **Contraseña**.
3. Verifique el estado de los miembros y del grupo antes de registrarse.

### Administrador
1. Revisar la composición de cada equipo y el estado de registro.
2. Intervenir si es necesario mediante acciones de administración.

![Manage your team](assets/screenshots/gerer-equipe-actions.png)

---

## Recordatorio de dominio
- **Single**: entrada individual.
- **Doble**: grupo de 2 jugadores.
- **Equipo**: grupo de 4 jugadores.
- El registro está operativo cuando el jugador/grupo está completo y registrado.
