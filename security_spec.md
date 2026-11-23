# Firestore Security Specification (`matches/{matchId}`)

## Data Invariants (2–4 Players)

1. **Identity & Seat Integrity**: A room can only be created with `hostUid == request.auth.uid`, `maxPlayers in [2, 3, 4]`, seat 0 owned by `request.auth.uid`, remaining seats open (`uid == null`), and `activePlayers == [request.auth.uid]`.
2. **No Duplicate Seat Claims**: A player joining a waiting room cannot already occupy a seat and may only claim an open seat (`uid == null && isBot == false`) using `request.auth.uid`.
3. **Owner-Only Seat Ready / Away**: In `waiting` state, players can only toggle `ready` on their own seat. In `active` state, players can only toggle `away` on their own seat.
4. **Host-Only Room Start & Kick**: Only `hostUid` may transition `status` from `'waiting'` to `'active'`, toggle `fillWithBots`/`teamMode`, or kick non-host seats (`seatIndex > 0`).
5. **Turn-Authorized Gameplay**: While `status == 'active'` and `winner == 'NONE'`, gameplay updates are restricted to seated/active participants and authorized only when:
   - caller holds `activeTurnIndex` (`players[activeTurnIndex].uid == request.auth.uid`), OR
   - active turn is a bot driven by `hostUid`, OR
   - active turn player is `away == true`, OR
   - the 20-second turn timer (`turnStartedAt + 20s`) has expired.
6. **Immutable Anchors & No Shadow Fields**: `matchId`, `roomCode`, `hostUid`, `matchSeed`, and `createdAt` never change; every `create` and `update` passes `isValidMatch(incoming())` plus strict `affectedKeys().hasOnly(...)`.
7. **Presence Cleanup**: Players may only remove their own UID from `activePlayers`. A document may be deleted by its last active player, by the host of a waiting room, or by any signed-in client sweeping a stale lobby older than 2 hours (`createdAt + 2h < request.time`).

## Adversarial Scenarios Blocked (`PERMISSION_DENIED`)

1. Unauthenticated read/create/update/delete (`request.auth == null`).
2. Spoofing `hostUid` or joining an open seat under another user's UID.
3. Injecting >4 players into `players` or `activePlayers`.
4. Non-host starting a waiting room or kicking another player.
5. Joining two seats in the same room with the same UID.
6. Toggling another player's `ready` or `away` flag.
7. Submitting an out-of-turn `PICK_STAT` / `TOGGLE_GAMBIT` before `turnStartedAt + 20s` while turn owner is active.
8. Modifying `matchSeed`, `roomCode`, or `hostUid` mid-match.
9. Injecting unknown shadow fields (`adminOverride`, etc.) into match or seat maps.
10. Mutating decks or winner after `status == 'finished'`.
11. Removing another player from `activePlayers` during leave.
12. Deleting an active or fresh (<2h) lobby belonging to other players.
