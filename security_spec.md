# Security Specification: imex Frontline Match

## 1. Data Invariants
1. **Per-Game Lock Key Integrity**: Every `playerLocks/{lockKey}` document MUST satisfy `lockKey == data.playerKey + '__' + data.mode` and `data.mode in ['match_board', 'quick_quiz']`. This guarantees each employee (`playerKey`) may complete Game 1 (`match_board`) once and Game 2 (`quick_quiz`) once, without allowing duplicate plays of the same game.
2. **Name Integrity**: Every `gameResults/{resultId}` record must provide non-empty `firstName` (1..60 chars), `lastName` (1..60 chars), and `fullName` (2..125 chars).
3. **Single-Admin Exclusivity**: Only the single bootstrapped admin (`jaelove363@gmail.com` with `email_verified == true`) may `get`, `list`, or `delete` `gameResults`, or `list`/`delete` `playerLocks`. No PII (`gameResults`) is readable by non-admins.
4. **Atomic Lock + Result Creation**: Creating `gameResults/{resultId}` requires that `playerLocks/{playerKey}__{mode}` does NOT exist beforehand (`!exists(...)`) and DOES exist atomically after the batch (`existsAfter(...)`).
5. **Immutable Records & Bounded Numerics / Arrays**: Both `playerLocks` and `gameResults` forbid updates (`allow update: if false`). All `createdAt` fields must equal `request.time`, numeric fields (`score`, `accuracy`, `maxCombo`, `mistakes`, `matchedCount`, `elapsedSeconds`) are strictly range-bounded, and `wrongAnswers` is strictly bounded to `<= 30` strings (`1..220` chars).

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Unauthenticated List PII**: Anonymous client attempts `list` on `/gameResults` or `/playerLocks`.
2. **Non-Admin Read Result**: Authenticated regular user attempts `get` or `list` on `/gameResults`.
3. **Spoofed Email Unverified**: Attacker with `email: 'jaelove363@gmail.com'` and `email_verified: false` attempts admin read on `/gameResults`.
4. **Duplicate Play Same Game**: Employee tries to submit a second `gameResults` document for `match_board` when `playerLocks/{playerKey}__match_board` already exists.
5. **Lock Key Mismatch Spoofing**: Attacker creates `/playerLocks/emp_abc__match_board` with `data.mode: 'quick_quiz'` or mismatched `lockKey`.
6. **Shadow Field Injection**: Attacker includes extra field `isAdmin: true` in `/playerLocks` or `/gameResults`.
7. **Score Tampering / Out-of-Range**: Attacker submits `score: 999999` or `accuracy: 150`.
8. **Score Log Mutation**: Attacker attempts to `update` an existing `/gameResults/{resultId}` to alter `score`.
9. **Lock Bypass / Mutation**: Attacker attempts to `update` or `delete` `/playerLocks/{lockKey}` without being Admin.
10. **Client Timestamp Forgery**: Attacker submits `createdAt` set to a past timestamp instead of `request.time`.
11. **ID Poisoning**: Attacker attempts to create `/gameResults/<1500-char-invalid-id>` with slashes/spaces.
12. **Orphaned Score Without Atomic Lock**: Attacker creates `/gameResults/{resultId}` without creating `/playerLocks/{playerKey}__{mode}` in the same atomic batch.
