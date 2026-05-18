# Feature Specification: In-Game Reactions

**Feature Branch**: `005-in-game-reactions`

**Created**: 2026-05-18

**Status**: Draft

**Input**: User description: "Reactions during the game like the Clash of Clans chat where players can send reactions (emojis) or premade sentences. There is a limit of reactions per minute to avoid spam. Players can mute other players. Emojis must contain: happy, sad, cry, applause, celebrate, money, cigar, wine, beer. Include all the Catalan premade sentences provided by the user."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Send an Emoji Reaction (Priority: P1)

A player in an active game match can send a short emoji reaction that is visible to the other players in the same match. Reactions are lightweight, timestamped, and associated with the sending player.

**Why this priority**: Quick reactions are core to the social game experience and enable fast, low-friction communication without text.

**Independent Test**: Start a match with 4 players, send an emoji from Player A, verify Players B/C/D receive and see the emoji within the match chat or reaction feed.

**Acceptance Scenarios**:

1. **Given** an active match, **When** Player A taps an emoji, **Then** all active players in the match see the reaction within 2 seconds.
2. **Given** Player A sends multiple different emojis, **When** the reactions arrive, **Then** each reaction displays with the sender's display name and a brief time indicator.
3. **Given** Player A has hit the reaction rate limit, **When** they attempt to send another emoji, **Then** the UI shows a non-modal message indicating the rate limit and blocks the new reaction.

---

### User Story 2 - Send a Premade Message (Priority: P1)

A player can send a premade message (one of a curated set of short Catalan phrases) to the match chat with a single tap. These messages are the localized, curated quick-chat options used for rapid, polite communication.

**Why this priority**: Premade messages reduce typing friction and keep the game socially interactive while minimizing abusive free-text chat.

**Independent Test**: From an active match, select and send each premade message once and confirm all other players receive the exact premade text.

**Acceptance Scenarios**:

1. **Given** an active match, **When** Player A selects a premade message, **Then** the message appears in the match chat for all players.
2. **Given** a premade message is sent, **When** a muted player sends the same message, **Then** it is not shown to players who muted them.

---

### User Story 3 - Reaction Rate Limiting (Priority: P1)

The system must limit how many reactions a single player can send per minute to prevent spam and abusive rapid-fire usage.

**Why this priority**: Prevents spam and preserves the social value of reactions.

**Independent Test**: Attempt to send reactions from a single player repeatedly and verify blocking behavior once the limit is reached.

**Acceptance Scenarios**:

1. **Given** Player A sends reactions rapidly, **When** they exceed the allowed number per minute, **Then** further reactions are blocked until the rolling window allows more.
2. **Given** the rate limit is in effect, **When** Player A waits until the rate window permits more reactions, **Then** they can send reactions again.

Resolved: Default reaction limit

- Default reaction limit: 10 reactions per 60-second rolling window (10/min). This default is configurable via `RateLimitPolicy` (fields: `maxReactions`, `windowSeconds`).


---

### User Story 4 - Mute Other Players (Priority: P1)

A player may mute another player so that the muted player's reactions and premade messages are not displayed to the muting player during matches and in match-related views.

**Why this priority**: Muting is the primary user control to avoid harassment or annoyance without involving moderators.

**Independent Test**: Player A mutes Player B, Player B sends reactions and premade messages, verify Player A no longer sees them but other players still do.

**Acceptance Scenarios**:

1. **Given** Player A mutes Player B, **When** Player B sends a reaction, **Then** Player A does not see that reaction.
2. **Given** Player A unmutes Player B, **When** Player B sends a reaction, **Then** Player A sees the reaction again.

Resolved: Mute scope

- Mute scope is set to: match-only. Mutes apply only for the remainder of the current match and are cleared at match end. This means a muting player will not see reactions or premade messages from the muted player for the duration of the active match.

---

### User Story 5 - Moderation & Abuse Controls (Priority: P2)

Tournament organizers or game moderators can disable reactions in a match or remove specific premade messages if they are found abusive. Moderators can also temporarily suspend a player's ability to react.

**Why this priority**: Protects community health and supports governance for competitive or public matches.

**Independent Test**: Moderator toggles reactions off for a match and verifies that the reaction UI is disabled for players in that match.

**Acceptance Scenarios**:

1. **Given** an active match, **When** a moderator disables reactions for that match, **Then** all players see reactions UI disabled and cannot send new reactions.

---

### Edge Cases

- A player reaches the limit exactly as a new reaction is submitted; which rule wins? (blocked)
- Network packet loss: reactions may be delayed or arrive out-of-order.
- A muted player joins a new match where the muting player is not present; mute scope affects behavior.
- Two players send conflicting premade messages at the exact same timestamp.
- Local time drift or device clock changes affecting rate-window calculations.
- A player edits their display name after sending reactions — historical reactions must continue showing the name used at send time.
- Offensive or profane premade messages discovered after deployment — moderation flow required.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow players in an active match to send lightweight emoji reactions.
- **FR-002**: System MUST provide a curated list of premade quick-chat messages in Catalan.
- **FR-003**: System MUST include at least the following emojis: `happy`, `sad`, `cry`, `applause`, `celebrate`, `money`, `cigar`, `wine`, `beer`.
- **FR-004**: System MUST display reactions and premade messages to all players in the same match unless the viewer has muted the sender.
- **FR-005**: System MUST implement a per-player reaction rate limit (configurable) to prevent spam. Default: 10 reactions per 60-second rolling window (10/min).
- **FR-006**: System MUST allow a player to mute another player; muting must suppress reactions and premade messages from the muted player for the muter for the remainder of the current match (match-scoped).
- **FR-007**: System MUST provide a UI affordance to mute/unmute a player from match UI and player list views.
- **FR-008**: System MUST provide moderation controls to disable reactions temporarily in a match or remove specific premade messages from the public set.
- **FR-009**: System MUST persist mute preferences according to the chosen scope; for match-scoped mutes the preference must persist for the match duration and be cleared at match end.
- **FR-010**: System MUST retain a short, auditable history of reactions for the duration of the match and preserve final match chat in match history for review.
- **FR-011**: System MUST not expose personally identifiable data beyond player display name in reaction events.

### Key Entities

- **Reaction**: {senderId, matchId, emojiKey, timestamp, metadata}
- **PremadeMessage**: {id, language, text, canonicalForm}
- **PlayerMute**: {muterId, mutedId, scope, createdAt}
- **RateLimitPolicy**: {playerId, windowSeconds (default 60), maxReactions (default 10)}
- **ReactionAuditEntry**: {reactionId, deliveryStatus, recipients}

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 99% of reactions sent in active matches are delivered to all present players within 2 seconds under normal network conditions.
- **SC-002**: Reaction rate limiting prevents more than the configured reactions per minute for a single player in 100% of observed attempts.
- **SC-003**: Muted players' reactions and premade messages are suppressed for the muting player in 100% of cases.
- **SC-004**: 95% of users can use premade messages without needing to type a custom message during gameplay (usability metric).
- **SC-005**: Moderators can disable reactions for a match and the UI reflects the disabled state within 5 seconds of action in 95% of cases.

## Assumptions

- The product will reuse the existing match chat or lightweight event transport; this spec does not mandate transport implementation.
- Premade messages are localized and the Catalan list provided by the user is used as the initial set for Catalan locale.
- The system will store only minimal metadata for reactions and not full message bodies except for premade messages which are canonical.
- Muting is a privacy control for the muter only and does not notify the muted player.

## Premade Messages (Catalan)

The following Catalan quick-chat options are included verbatim from user-provided content. They should be reviewed for tone and edited if moderation requirements dictate.

--- BEGIN CATALAN PREMADE MESSAGES ---

ButiNET
ButiNET, el joc de la botifarra per Internet

Saltar fins al contingut

Cerca…
CercaCerca avançada
Enllaços ràpids
PMFInicia la sessió
Índex del fòrumTemes TancatsRelíquies
Dites Populars de la Botifarra
Respon

Cerca al tema…
CercaCerca avançada
18 entrades 
1
 
2
 
Següent
alp2500
Barretina
Barretina
Entrades: 709
Membre des de: 02 oct. 2002, 12:00
Dites Populars de la Botifarra
EntradaAutor: alp2500 » 29 juny 2004, 14:42

Hola Botifarraires, l'altre dia buscant coses de la Botifarra vaig trobar un llistat de dites botifarraires, i vaig dir segur que en cada poble sempre hi ha alguna dita particular aquí us posso les que vaig trobar a la pagina web i agrairia a la gent que si en te alguna mes l'expliques

moltes gràcies
psc

Dites botifarrils:

La botifarra es un joc de muts
De Manilla no saldrás si no tienes Rei o As, o muchos más
Dos Manilles i un As: Botifarra cantaràs
De Farmaceutic no sortiras i elegant seràs
De Mirón començeras i un bon jugador seràs
Sortin d’As el sacrificaràs però el teu rei salvaràs
No siguis passarell si el nou vols guanyar
De Sant Celoni no has de sortir si al teu company no vos espantar
Malgrat que siguis monarquic amb el rei has d’arriscar
La botifarra a cent ningu mai la guanyant
Quita amb els 69 donçs ti pots quedar del bé que et trobaras
No et cambiaria el resultat doncs ara dono jo
Torna a l’inici
DeepButi
Barretina
Barretina
Entrades: 1394
Membre des de: 12 nov. 2002, 11:30
EntradaAutor: DeepButi » 29 juny 2004, 17:11

Del que en sóc amo no en vull ser mosso (en altres paraules: amb Manilla i Rei no surtis de Manilla)
Caga més un bou que cent orenetes (o sigui: millor molts d'una tacada que moltes mans petitones)
Jugador de carta sola, jugador de ca'n titola (aquestes sortides de semi ...)
"De lo que me voy no me vengas" (descart negatiu s'en diu d'això)

... i la definitiva:

Fill meu, tingues bó (versió castellana: "Dame Manillas y quítame el conocimiento")
Torna a l’inici
larvi
Botifarra
Botifarra
Entrades: 103
Membre des de: 20 des. 2002, 02:38
EntradaAutor: larvi » 29 juny 2004, 19:26

magraden les dites, numes aclarir ,com sabeu els que vareu ser a ALP el cap de setmana, que al nostre poble "A 100 S'ACABEN TOTES" joujoujoujuojuo

asiauu salud i manilles, i bona gent per fer xerinolaaaaaaaaaaa
Torna a l’inici
alp2500
Barretina
Barretina
Entrades: 709
Membre des de: 02 oct. 2002, 12:00
EntradaAutor: alp2500 » 30 juny 2004, 08:46

Be ara en afegim unes quantes mes


Tres de un palo malo.
Què vol dir això? . Es senzill. Si cada pal té 12 Cartes, és francament difícil que cada jugador en tingui 3 de cada oi ?. LLavors , quan tirem la tercera carta d'aquell pal, es diu que son 3 de un pal dolent, perquè el mes segur es que algú hi falli.


La botifarra la va inventar un sord (i el seu company era mut).
Bé, aquesta dita, senzillament ve a dir que en el joc de la botifarra no es pot parlar de cap de les maneres. De vegades, a la majoria de llocs i entre amics, es juga a crits, pero en un campionat, no es pot dir ni mu.


Sortida de cavall,sortida d'animal.
La sortida de caball es la sortida mes perillosa que hi ha, ja que si sortim de cavall, el company de la dreta, es pot veure obligat a posar el rei, el nostre company el as, i els contraris la manilla, amb el que s'ha fet una jugada de 15 punts, on nomès queda la sota guanyadora.


De manilla no sortiràs si no tens rei o as.
Aquesta també es clara. Si tenim la manilla, no la tirarem mai de cara (aqui es podria fer alguna excepcio que ara explicarem), ja que si tirem la manilla de cara, es evident que si els companys contraris tènen el As, no el tiraràn, a no ser, que nomès tinguin aquesta carta. La excepcio la fariem quan tenim moltes cartes d'aquell pal , i li tirem la manilla al company per a que no s'abarroti cap punt i indicar-li que en tenim moltes d'aquell pal.


La sortida del company no es nega mai.
Sempre que el company sorti de un pal, li hem de tornar.Sempre sempre sempre, ja que es ell qui està marcant el joc.


Botifarra passada, botifarra disgustada.
Si passem la mà al company, es perque no tenim cap bon pal amb el qual jugar, per tant si el company ens canta botifarra, es difícil que ens en sortim bé.

Triomf passat, triomf contrat.
Quan algú passa el triomf, es fàcil que la parella contrària contri, ja que, d'alguna manera els donem la pista de que no anem be de cartes.

Pel cul te les fotin totes.
Be, encara que sembli una mica marranot, això es diu de les copes, quan el teu company canta copes com a triomf i no en tens cap. Copes ? Pel cul te les fotin totes.

Dos manilles i un as, botifarra faràs.
Amb dues manilles i un as, nomès que el company acompanyi un xic, es natural cantar botifarra, ja que tenim dues manilles que ens serviràn per a recuperar el pal i un as, que també ajuda no ? ;-) .
Torna a l’inici
mikis
dites
EntradaAutor: mikis » 30 juny 2004, 21:41

Anota akesta:
CON BUENA PICHA BIEN SE JODE
ho entens oi?
Tú dona'm bones cartes q veuràs on van a parar les normes dels butifarraires...
Torna a l’inici
alp2500
Barretina
Barretina
Entrades: 709
Membre des de: 02 oct. 2002, 12:00
EntradaAutor: alp2500 » 01 jul. 2004, 14:32

Bé mikis company en relació a la teva frase :

Anota akesta:
CON BUENA PICHA BIEN SE JODE
ho entens oi?
Tú dona'm bones cartes q veuràs on van a parar les normes dels butifarraires...

aquesta no es més que la que diu en deep-buti

Fill meu, tingues bó (versió castellana: "Dame Manillas y quítame el conocimiento")

no deixa de ésser lo mateix pero canviant la frasse, de totes maneres t'agraeixo la teva petita aportació

a reveure

psc
Torna a l’inici
CiutatDeSal
Barretina
Barretina
Entrades: 159
Membre des de: 18 set. 2002, 16:17
EntradaAutor: CiutatDeSal » 01 jul. 2004, 20:05

Ta bé això de les dites populars ... és divertit (sobretot el de ... "con una buena polla que bien se folla", que a més rima :-P)

... només que, ja sé que les dites populars acostumen a ser molt savies i tenen el seu raonament. L'experiència és un grau, que diuen.

Però és bo matisar que, segons el meu modest entendre, a la butifarra hi ha poques coses que vagin a missa. Vull dir ... per exemple ... és clar que ... "sortida de cavall sortida d'animal" ... però de fet, si el de la meva dreta té el rei, el company l'as i el de l'esquerra la manilla ... surti del que surti, si toco aquest pal, lo més normal és que el as voli. L'únic especialment dolent que té sortir de cavall és que son més punts.

Si no, si fos tant fàcil com mantenir unes lleis (dites) i seguir-les al peu de la lletra ... els robots d'en DeepButi guanyarien absolutament tots els campionats en que han participat ... i ... ara no recordo les estadístiques ... quant campionats han guanyat???? :lol: jijijiji

Torna a l’inici
alp2500
Barretina
Barretina
Entrades: 709
Membre des de: 02 oct. 2002, 12:00
EntradaAutor: alp2500 » 01 jul. 2004, 23:20

Ciutat passarelll , nasos nen tu no pares eh , sempre m'has de matxacar,jejejejejejej
be ara ens posen seriosos, Quan dius:

només que, ja sé que les dites populars acostumen a ser molt savies i tenen el seu raonament. L'experiència és un grau, Però és bo matisar que, segons el meu modest entendre, a la botifarra hi ha poques coses que vagin a missa.

Clar que si tens tota la rao, pero les dites populars de la botifarra no son lleis que s'han de seguir al peu de la lletra, a vegades tenen la seva rao d'ésser pero no son els 10 manaments ni res de tot aixo, cada ú te les seves lleis i la seva manera de jugar , en canvi em feia gràcia veure com es diuen les coses a altres contrades i res mes no vol pas ésserd e cap manera les lleis de la botifarra per això ja hi ha mestres que escriuen llibres sobre el tema,

vinga una abraçada
a reveure

Psc
Torna a l’inici
Carles
Carles
Carles
Entrades: 2252
Membre des de: 15 set. 2002, 23:42
EntradaAutor: Carles » 02 jul. 2004, 13:11

Aqui et manca una cosa que els robots de moment no tenen que es intuicio, el dia que aquets animalons infernals la tinguin seran els reis

Torna a l’inici
DeepButi
Barretina
Barretina
Entrades: 1394
Membre des de: 12 nov. 2002, 11:30
EntradaAutor: DeepButi » 02 jul. 2004, 14:41

alp2500,
existeix una nova versió del programa que permet algunes coses interessants com per exemple repetir un dat -amb les teves mateixes cartes o amb les de qualsevol dels altres jugadors- per fer realitat allò de "que animal!, si hagués fet això o allò altre, m'hauria anat millor" o "què hagues passat si barroto?" etc etc.

Jugar, el que es diu jugar, juga amb els mateixos robots que al ButiNET.

Pels tècnics: només funciona amb el .NET instal·lat o sigui que pels que no ténen XP potser sigui una mica complicat ...

Carles,
aviat aviat ???? No pas els meus ... i els que estas fent tú ... jeje ... molt optimista et veig 8) (i dubto que s'en pugui dir intuicio d'aplicar la força bruta!).

Apa, tingueu manilles
Torna a l’inici
fritz
Barretina
Barretina
Entrades: 360
Membre des de: 22 set. 2003, 12:01
EntradaAutor: fritz » 02 jul. 2004, 15:15

Amb un bon penis espero que no perdis! ( és penosa peró l'acavo d'inventar) :oops:
Dona'm bones cartes i veuràs on van a parar les normes dels butifarraires?
Discrepo, company mikis, més aviat aquesta frase la solem dir els jugadors després de rebre una sobirana palissa!
Em veig amb cor de dir que només tenir bones cartes no és garantia absoluta per guanyar una partida, és necessari jugar-les bé, d'altre banda, no crec que el joc que tant ens apassiona, una prova d'aixó és aquest foro, tingués sentit.
Perquè sino no caldria jugar, es faria el dad i es diria: a veure, tinc una manilla , un as, dos reis faré tres bases, total 18 punts, apa, tornem a donar!
Sóc del parer que tot joc a de tenir una tàctica, una manera de jugar per intentar fer el màxim de punts possibles, i més, com és el cas de la butifarra que és un joc de companys.
D'altre banda dir, em sembla que no calia peró no vull malentesos, que sense bo no es guanya ni una partida.

Fins ara!
Torna a l’inici
--- END CATALAN PREMADE MESSAGES ---


## Implementation Notes (non-mandatory)

- The UX should keep reactions small and unobtrusive: e.g., a compact reaction bubble or toast in the match UI.
- Consider providing lightweight animation for ephemeral visual feedback but ensure animations do not block gameplay or input.


