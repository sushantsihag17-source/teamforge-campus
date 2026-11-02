'use strict';

// The browser contains ONLY the public Supabase anon/publishable key.
const AuthGate = (() => {
  let client = null, current = null, complete = null, phase = 'sign-in';

  const screen = () => document.getElementById('auth-screen');

  const message = (s, bad = false) => {
    const el = document.getElementById('auth-message');
    if (el) {
      el.textContent = s;
      el.style.color = bad ? '#b42318' : '#236b67';
    }
  };

  function frame(content) {
    screen().innerHTML = `
      <div class="auth-layout">
        <div class="auth-top">
          <span class="auth-logo">✳</span>
          <b>Colliq</b>
          <span class="auth-mini">CAMPUS COLLABORATION</span>
        </div>

        <div class="auth-panel">${content}</div>

        <div class="auth-bottom">
          Build together. Grow together.
          &nbsp;·&nbsp; Student collaboration platform
        </div>
      </div>
    `;

    screen().classList.remove('hidden');
  }

  function form(mode = 'sign-in') {
    phase = mode;
    const signup = mode === 'sign-up';

    frame(`
      <div class="auth-chip">
        YOUR CAMPUS, YOUR COMMUNITY
      </div>

      <h1>
        ${signup ? 'Create your account' : 'Welcome to Colliq'}
      </h1>

      <p>
        Connect with real students, find project partners
        and start building together.
      </p>

      <div class="auth-switch">
        <button
          type="button"
          data-auth-tab="sign-in"
          class="${!signup ? 'active' : ''}">
          Sign in
        </button>

        <button
          type="button"
          data-auth-tab="sign-up"
          class="${signup ? 'active' : ''}">
          Create account
        </button>
      </div>

      <form id="auth-form" class="auth-form">

        <label>
          Email address
          <input
            type="email"
            name="email"
            autocomplete="email"
            placeholder="you@example.com"
            required>
        </label>

        <label>
          Password
          <input
            type="password"
            name="password"
            autocomplete="${signup ? 'new-password' : 'current-password'}"
            minlength="6"
            placeholder="At least 6 characters"
            required>
        </label>

        <button type="submit" class="auth-submit">
          ${signup ? 'Create account' : 'Sign in'} →
        </button>

      </form>

      <div id="auth-message" role="status"></div>

      <p class="auth-note">
        ${signup
          ? 'Use your own email. You may need to confirm it before signing in.'
          : 'Your account is protected by Supabase Authentication.'}
      </p>
    `);
  }

  function showSetup(done) {
    complete = done;

    frame(`
      <div class="auth-chip">ONE LAST STEP</div>

      <h1>Tell us about yourself</h1>

      <p>
        Your real profile will help other students discover you.
        Only publish details you are comfortable sharing.
      </p>

      <form id="setup-form" class="auth-form">

        <div class="auth-two">

          <label>
            Full name
            <input
              name="name"
              required
              maxlength="55"
              placeholder="Your full name">
          </label>

          <label>
            Username
            <input
              name="handle"
              required
              minlength="3"
              maxlength="30"
              placeholder="your.handle">
          </label>

        </div>

        <div class="auth-two">

          <label>
            Program
            <input
              name="program"
              required
              maxlength="65"
              placeholder="CSE · AI & ML">
          </label>

          <label>
            Study year
            <select name="year">
              <option value="1">1st year</option>
              <option value="2" selected>2nd year</option>
              <option value="3">3rd year</option>
              <option value="4">4th year</option>
            </select>
          </label>

        </div>

        <label>
          Skills, separated by commas
          <input
            name="skills"
            required
            placeholder="Python, DSA, JavaScript">
        </label>

        <label>
          Interests, separated by commas
          <input
            name="interests"
            required
            placeholder="Hackathons, AI, Startups">
        </label>

        <label>
          Short bio
          <textarea
            name="bio"
            maxlength="220"
            placeholder="What do you want to build?"></textarea>
        </label>

        <label>
          Availability
          <select name="availability">
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
        </label>

        <button class="auth-submit" type="submit">
          Complete my profile →
        </button>

      </form>

      <div id="auth-message" role="status"></div>

      <button
        class="auth-text-button"
        type="button"
        id="auth-logout">
        Sign out instead
      </button>
    `);
  }

  function hide() {
    screen().classList.add('hidden');
    screen().innerHTML = '';
  }

  async function init(onSignedIn) {

    if (typeof supabase === 'undefined') {
      throw new Error(
        'Authentication library did not load. Check your internet connection.'
      );
    }

    const response = await fetch('/api/config');
    const config = await response.json();

    if (!response.ok) {
      throw new Error(config.error || 'Backend not configured yet.');
    }

    client = supabase.createClient(
      config.url,
      config.anonKey,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        }
      }
    );

    screen().addEventListener('click', async (e) => {

      const tab = e.target.closest('[data-auth-tab]');

      if (tab) {
        form(tab.dataset.authTab);
        return;
      }

      if (e.target.id === 'auth-logout') {
        await logout();
        return;
      }
    });

    screen().addEventListener('submit', async (e) => {

      if (e.target.id === 'auth-form') {

        e.preventDefault();

        const fields = Object.fromEntries(
          new FormData(e.target).entries()
        );

        const btn = e.target.querySelector('button[type=submit]');
        btn.disabled = true;

        try {

          if (phase === 'sign-up') {

            const { data, error } = await client.auth.signUp({
              email: fields.email,
              password: fields.password,
              options: {
                emailRedirectTo: location.origin
              }
            });

            if (error) throw error;

            if (!data.session) {
              message(
                'Account request received. Check your email for a confirmation link, then sign in.'
              );
              return;
            }

          } else {

            const { error } = await client.auth.signInWithPassword({
              email: fields.email,
              password: fields.password
            });

            if (error) throw error;
          }

          const {
            data: { user },
            error
          } = await client.auth.getUser();

          if (error) throw error;

          current = user;
          await onSignedIn();

        } catch (err) {

          message(err.message, true);

        } finally {

          btn.disabled = false;
        }
      }

      if (e.target.id === 'setup-form') {

        e.preventDefault();

        const fields = Object.fromEntries(
          new FormData(e.target).entries()
        );

        const btn = e.target.querySelector('button[type=submit]');
        btn.disabled = true;

        try {

          const parse = s =>
            String(s || '')
              .split(',')
              .map(x => x.trim())
              .filter(Boolean);

          const {
            data: { session }
          } = await client.auth.getSession();

          if (!session) {
            throw new Error('Please sign in again.');
          }

          const response = await fetch('/api/users', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              ...fields,
              skills: parse(fields.skills),
              interests: parse(fields.interests)
            })
          });

          const outcome = await response.json();

          if (!response.ok) {
            throw new Error(
              outcome.error || 'Could not save profile'
            );
          }

          await complete();

        } catch (err) {

          message(err.message, true);

        } finally {

          btn.disabled = false;
        }
      }
    });

    const {
      data: { session }
    } = await client.auth.getSession();

    if (session) {
      current = session.user;
      await onSignedIn();
    } else {
      form();
    }
  }

  async function accessToken() {
    if (!client) return null;

    const {
      data: { session }
    } = await client.auth.getSession();

    return session?.access_token || null;
  }

  function userId() {
    return current?.id || null;
  }

  async function logout() {
    if (client) {
      await client.auth.signOut();
    }

    current = null;
    complete = null;
    form();
  }

  return {
    init,
    hide,
    showSetup,
    accessToken,
    userId,
    logout
  };

})();
