# Security Notes

## Browser-Stored OAuth Tokens

Misty currently stores Google and Spotify OAuth session data in browser `localStorage`.
This keeps the desktop/web app simple, but it means tokens are readable by any script that
executes in the app origin. Treat this as acceptable only for local development and trusted
single-user deployments.

Recommended follow-up:

- Move refresh tokens to an HTTP-only cookie or server-side session store.
- Keep browser access tokens short-lived and rotate them through server routes.
- Re-test Spotify callback, Google Calendar reconnect, and desktop Tauri flows after migration.
