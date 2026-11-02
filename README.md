# TeamForge — Real-Account Campus Collaboration (Render + Supabase)

A white-theme campus collaboration website. Students create **real accounts**, register their own profiles, post projects, recruit teammates, apply, and accept invitations. The algorithms run in JavaScript behind the scenes. **No seeded students, dummy projects, demo logins or public DSA visualizers.** The database is empty until real students register.

## Technology for Semester 3

| Layer | Language / service |
|---|---|
| Website layout | HTML5 |
| Appearance | CSS3 |
| Interactive frontend | Vanilla JavaScript |
| Server | Node.js (JavaScript), built-in `http` module |
| Real login | Supabase Authentication (email/password) |
| Permanent records | Supabase PostgreSQL via REST API |
| Deployment | GitHub + Render Web Service |
| Algorithms | Vanilla JavaScript in `src/algorithms.js` |

No Python or C++ is needed to run this project. No frontend framework, npm runtime packages, or AI API is required. The frontend does load the official Supabase JavaScript SDK from its CDN to manage login sessions.

## 1. Create your Supabase database

1. Visit https://supabase.com/dashboard and create a project. Keep its database password safe.
2. Open **SQL Editor** → **New query**.
3. Copy and run the entire `database/schema.sql` file. It creates the tables, database constraints and transactional functions; no sample rows.
4. Open **Project Settings → API Keys** (or the dashboard's API Keys section). Copy the project URL, the **anon / publishable** key, and a **service_role / secret** server key.
5. Never put the service-role/secret key in HTML, browser JavaScript, a public GitHub file or a screenshot. It belongs **only** in Render's secret environment settings.
6. In **Authentication → Providers → Email**, keep email/password auth enabled and preferably require email confirmation.

## 2. Publish to GitHub

1. Create a new GitHub repository named `teamforge-campus` (private or public).
2. Upload the **contents of this `TeamForge` folder** to the repository root (not the ZIP itself). Make sure GitHub shows `server.js`, `package.json`, `public/`, `src/`, `database/`, and `render.yaml`.
3. Never upload `.env` or any real keys. `.gitignore` excludes `.env` by default.

## 3. Deploy to Render

1. Go to https://dashboard.render.com/ and sign in with GitHub.
2. Click **New → Web Service**, select `teamforge-campus`.
3. Set **Runtime:** Node, **Branch:** main, **Build Command:** `npm install`, **Start Command:** `npm start`, **Instance Type:** Free (if offered).
4. In **Environment**, add:

   ```
   NODE_ENV=production
   SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY=YOUR_SECRET_SERVER_KEY
   ```

5. Click **Create Web Service**. Wait for the deployment to report success.
6. Open the generated HTTPS address (for example `https://teamforge-campus.onrender.com`). The exact hostname is assigned by Render and may differ.
7. Check `https://YOUR_RENDER_URL/api/health`. It should return `{"ok":true,"service":"TeamForge"}`.

Render can read the included `render.yaml` blueprint too, but the standard Web Service wizard is simpler for a first deployment.

## 4. Configure email confirmation redirects

In Supabase → **Authentication → URL Configuration**:

- **Site URL:** your exact `https://...onrender.com` address.
- **Redirect URLs:** add the same address with `/**` or the exact paths you plan to use. For local development also allow `http://localhost:3000/**`.

This allows users to follow their email confirmation links back to the live TeamForge website. Supabase's built-in email sender has limits; for broader deployment configure an approved SMTP provider.

## 5. Test real users (without dummy records)

1. Open the live site in your browser and click **Create account**.
2. Sign up using an actual email address and a password; verify the email if prompted.
3. Sign in and complete your real student profile (name, program, skills, interests).
4. Create a project. Reload the website: the project should still be there.
5. Ask a classmate to sign up with their own email in another browser or device.
6. From your profile, invite your classmate or let them apply. Log in as the classmate to accept. Verify the roster updates.

There are **no default student accounts** or hardcoded credentials. This means teammate recommendations will be empty until at least two genuine profiles exist.

## 6. Local development (optional)

Install Node.js 18+ (Node 20 or 22 is recommended) and set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` as environment variables in your local terminal. Do not commit credentials. Then run `npm start` and open http://localhost:3000. The Windows launcher starts the server but expects the variables to already be set.

Run `npm test` for the independent ADSA unit tests. Those tests use tiny synthetic fixtures *inside the test file only*; the website never imports those fixtures.

## Security and operational notes

- Browser clients see only the Supabase **public anon/publishable key**. The secret service-role key remains server-side.
- Every data API route verifies the caller's Supabase Auth token. Owners approve project applications; invited users accept their own invitations.
- SQL tables have RLS enabled and deny browser data access. The Node backend is the only intended gateway.
- This is a **campus pilot**, not a university-verified identity provider. Any email holder can sign up unless you configure an institution-email requirement and verify ownership. Do not claim accounts are official university identities.
- Do not upload confidential student records. A published student profile (name, skills, year) is visible to other logged-in members; obtain consent from test participants.
- Free Render servers can sleep after inactivity, and Supabase free projects have usage and inactivity limits. Review backups and abuse controls before launching broadly.
- Before larger-scale public rollout add rate limiting, spam moderation, account deletion/privacy controls, email delivery monitoring, database backups, and abuse reporting.
- **Important:** The external Supabase configuration is not included, so this ZIP is deployable but cannot be a working live site until you create the Supabase project and add your keys.
