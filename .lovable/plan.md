# Get the app onto your phone as a PWA

The app already has a manifest, icons, and Apple touch tags wired up in `src/routes/__root.tsx` and `public/manifest.webmanifest`. No code changes are needed for installability — it just needs to be published so your phone can load it from a real HTTPS URL (preview URLs work too, but published is the right surface for an installed app).

## Steps

1. **Publish the app** via `preview_ui--publish`. This deploys the current build to `https://<slug>.lovable.app`.
   - Preflight: confirm title ("Guaranteed Standards") and meta description ("Hit the standard. Nothing extra.") in `__root.tsx` are good as-is. No edits needed.
2. **Share the published URL with you** so you can open it on your phone.
3. **Install on home screen:**
   - **iPhone (Safari):** open URL → Share → "Add to Home Screen" → Add. Launch from the new icon → runs standalone, no Safari chrome.
   - **Android (Chrome):** open URL → three-dot menu → "Install app" (or "Add to Home screen") → Install. Launches standalone from the icon.
4. **Test the week-long flow** per the checklist in `docs/tasks.md` (Setup → daily Plan → Check-ins → Wave advance → Persistence across app close/reopen).

## Notes

- IndexedDB persists per-device, per-origin. Data stays as long as you don't clear site data or uninstall.
- After install, `start_url`, `scope`, and `display` are cached by the OS. If we later change those, you'd need to reinstall — so we'll leave them alone.
- No offline support yet (no service worker, by design — keeps preview safe). The app needs network to load, but once loaded all interactions are local.
- Future republishes update the live URL automatically; the installed icon keeps working.

Approve and I'll publish.