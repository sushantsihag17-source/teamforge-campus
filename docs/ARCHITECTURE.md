# TeamForge Architecture and ADSA Viva Notes

## Purpose

TeamForge addresses the difficulty of finding suitable collaborators for campus hackathons and semester projects. Students can discover profiles, find open projects, apply to teams, and automatically generate skill-balanced teams using explainable algorithms.

## Architecture

```text
                 Browser (HTML + CSS + Vanilla JavaScript)
                                  |
                  Student-facing pages / cards
                                  |
                           fetch() / JSON
                                  |
                    Node.js built-in HTTP server
                                  |
             +--------------------+--------------------+
             |                    |                    |
       REST operations         DSA engine         Persistence
       users/projects        src/algorithms.js    Supabase PostgreSQL
       apply/accept           (actual logic)     (persistent DB)
             |                    |                    |
             +--------------------+--------------------+
```

All application data lives in Supabase PostgreSQL and is accessed through authenticated Node.js REST endpoints. No fabricated students or seed rows are loaded. The frontend displays student profiles, matching suggestions and team records. Algorithm traces and graph traversal data are intentionally not presented to regular users.

## Model

- `Student`: id, name, username, study program, year, bio, skills, interests, availability, avatar color.
- `Project`: id, owner, title, description, category, required skills, capacity, members, applications, invitations.
- `Application`: candidate ID, message, state (pending/accepted/declined).
- `Invitation`: invited student ID, state (pending/accepted/declined), timestamp.
- `Activity`: user, action, timestamp.

## 1. Hash table: user and project lookup

`indexes(data)` builds `Map<string, User>` and `Map<string, Project>` from the current records.

- Construct index: O(n).
- Retrieve ID: O(1) average.
- Why: avoids repeatedly scanning lists during matching and graph traversal.

## 2. Heaps: candidate ranking

A custom binary max-heap (`MaxHeap`) stores `{user, score}` entries.

- `push`: O(log n), `pop`: O(log n), peek: O(1) if implemented.
- Why: efficiently retrieve the highest-scoring remaining candidate.
- Full ranking n candidates: O(n log n).

### Transparent compatibility scoring

Scores weight:

- Common interests: 30%.
- Shared skills: 20%.
- Complementary skills: 30%.
- Candidate availability: 15%.
- Existing shared project history: 5%.

Values are normalized and rounded to a score of 0–99 for distinct users. The scores are rule-based suggestions and should not be described as AI-powered assessments or measures of personality.

## 3. Graph: collaboration links

Use an undirected weighted graph with adjacency lists (`Map<userId, Map<userId, strength>>`). Edge weight:

```text
strength = 2 × sharedSkills + 1 × sharedInterests + 4 × sharedProjectFlag
```

A link exists when its strength exceeds zero. Graph nodes and edges are computed from current data, so changes to profile skills or memberships update the network.

- Build graph: O(n² × (skills/interests/project comparisons)).
- BFS traversal: O(V+E), using a queue and visited set.
- The graph logic is retained for ADSA coursework and programmatic testing, but there is **no graph visualization in the website**.

## 4. Bipartite matching: automatic teams

**Left partition:** required skill slots, e.g., React, Python, UI/UX.

**Right partition:** available students (excluding leader and Low-availability profiles).

Create an edge when a student has the required skill.

For each skill slot, run augmenting-path DFS. When a student is already assigned, recursively try to reassign their original slot to an alternate student before taking the student for the current slot.

```text
for each required slot:
  try augment(slot, visitedStudents = {})

augment(slot, visited):
  for student in eligibleCandidates(slot), ordered by compatibility:
    if student already in visited: continue
    visited.add(student)
    if student is unassigned or augment(student.previousSlot, visited):
      assign student to slot
      return true
  return false
```

- Maximum **number** of filled slots (cardinality), not maximum compatibility weight.
- Each student receives at most one required slot.
- Remaining places are filled using a max-heap of unassigned available students.
- Trace events are available internally for testing and viva discussion but are **not shown in the interface**.
- Complexity: O(VE) for augmenting-path matching; O(n log n) for heap ranking.

## Student-facing demo flows

1. **Team generation:** select 4 students and React, Node.js, UI/UX → actual DFS assigns three distinct students → review suggested teammate cards and skill coverage.
2. **Invite members:** publish a project from the generated team → project owner sends invitations → switch to invitee profile → accept → team membership increases.
3. **Applications:** apply to someone else's project → switch to owner → accept/decline → project's roster changes.
4. **Profile updates:** change your skills → see personalized teammate suggestions update without exposing internal data structures.

## API reference

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/bootstrap` | All profiles, projects, activity, aggregate counts |
| GET | `/api/matches?userId=u1` | Ranked candidates |
| GET | `/api/projects/recommended?userId=u1` | Ranked open projects |
| GET | `/api/network?userId=u1` | Internal graph and BFS data (not shown in website) |
| POST | `/api/team/generate` | Skill-based team recommendations |
| POST | `/api/users` | Create demo profile |
| PATCH | `/api/profile` | Edit demo profile |
| POST | `/api/projects` | Create project |
| POST | `/api/projects/:id/apply` | Apply to project |
| POST | `/api/projects/:id/decision` | Owner accepts/declines application |
| POST | `/api/projects/:id/invite` | Owner invites a collaborator |
| POST | `/api/projects/:id/invitation-decision` | Invitee accepts/declines |
| POST | `/api/reset` | Restore fictional seed data (demo-only) |

## Limitations and extensions

This prototype uses demo identity switching; it is intentionally **not secure authentication**. It does not guarantee collaborator suitability, verify student enrollment or actually send emails/push notifications. It stores data on the local filesystem. For deployment, use secure accounts, privacy consent, role-based authorization and a hosted transactional database.

Potential future enhancements: real-time notifications via WebSocket, optional GitHub portfolio links, availability calendars, team chat, mentoring, and university SSO.

## Viva questions (short answers)

**Why not just sort a list?** A max-heap expresses priority-queue operations explicitly and supports dynamic insertions/pops, and supports efficient ranking when candidate scores change.

**Why bipartite matching?** Roles and students form two separate kinds of nodes; a matching guarantees that each role has at most one assigned student and each student fills at most one mandatory role.

**Does it guarantee the best team?** It guarantees maximum cardinality of eligible skill-role assignments, not globally optimal subjective team fit.

**Why BFS?** It finds all profiles reachable in the collaboration network using a queue and a visited set.

**Why hash maps?** Fast average-time retrieval by ID when matching, reviewing applicants and rendering profiles.

## Deployment architecture (live edition)

- `public/auth.js`: Supabase Auth email/password registration, login, verification redirect, profile onboarding.
- `server.js`: validates each API request by calling Supabase Auth `/auth/v1/user`, enforces the logged-in user's ID, and authorizes owner/member actions.
- `src/supabase.js`: backend-only adapter for Supabase REST and PostgreSQL data; no public secret.
- `database/schema.sql`: PostgreSQL tables with row-level security enabled, database uniqueness constraints, and transactional stored functions for team membership.
- `public/app.js`: student-facing discovery, team builder, projects, and activity. No DSA traces or algorithm screens.
- `src/algorithms.js`: unchanged, deterministic ADSA ranking and skill matching.

**Important:** Current matching computations operate over a snapshot of profiles and projects fetched by the Node server, suitable for small academic pilots. At larger scale use paginated database queries and server-side scoring/indexing. Real students need to opt in before their profiles are listed.
