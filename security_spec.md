# Firestore Security Specification (`matches/{matchId}`)

## Data Invariants

1. **Identity Integrity**: A match document can only be created when `hostUid == request.auth.uid`, `guestUid == ""`, and `activePlayers == [request.auth.uid]`.
2. **Immutable Anchors**: `matchId`, `hostUid`, `matchSeed`, and `createdAt` can never change after document creation.
3. **Strict Lifecycle & Terminal Lock**: Gameplay mutations (`round`, `p1Deck`, `p2Deck`, `warPot`, `activeTurn`, `activeRealm`, `gambitUsed`, `resurrectionUsed`, `winner`) are only permitted while `existing().status == 'active'` and `existing().winner == 'NONE'`.
4. **Presence Cleanup**: Players may only remove their own UID from `activePlayers`. A document may be deleted by its last active player, by the host of a waiting lobby, or by any signed-in client sweeping a stale lobby older than 2 hours (`createdAt + 2h < request.time`).
5. **No Shadow Fields**: Every `create` and `update` passes `isValidMatch(incoming())` plus strict `affectedKeys().hasOnly(...)` action allowlists.
6. **Temporal Integrity**: `createdAt == request.time` on creation and `updatedAt == request.time` on every update.

## Dirty Dozen Adversarial Payloads

1. **Unauthenticated Create**: Create a match with `request.auth == null` -> `PERMISSION_DENIED`.
2. **Identity Spoofing**: Create a match setting `hostUid` to another user's UID -> `PERMISSION_DENIED`.
3. **Shadow Ghost Field**: Create or update a match injecting `isVerified: true` or `adminOverride: true` -> `PERMISSION_DENIED`.
4. **ID Poisoning**: Create a match at `/matches/invalid$id!` or a 200-char ID -> `PERMISSION_DENIED`.
5. **Backdated Timestamp**: Create a match with a client-supplied `createdAt` 3 hours in the past to abuse stale deletion -> `PERMISSION_DENIED`.
6. **Non-Participant Turn Injection**: Update `p1Deck` / `winner` on an active match as a third-party UID -> `PERMISSION_DENIED`.
7. **Post-Terminal Mutation**: Update `winner` or `p1Deck` after `status == 'finished'` -> `PERMISSION_DENIED`.
8. **Host Seed Tampering**: Modify `matchSeed` or `hostUid` during a gameplay update -> `PERMISSION_DENIED`.
9. **Oversized Deck Array**: Supply 61+ card IDs in `p1Deck` -> `PERMISSION_DENIED`.
10. **Blanket Private List Scraping**: Query `matches` without filtering out active matches belonging to other players -> `PERMISSION_DENIED`.
11. **Removing Opponent From `activePlayers`**: Leave-match update that removes the opponent's UID instead of `request.auth.uid` -> `PERMISSION_DENIED`.
12. **Premature Stale Delete**: Non-participant attempts to delete a `waiting` lobby created 10 minutes ago -> `PERMISSION_DENIED`.
