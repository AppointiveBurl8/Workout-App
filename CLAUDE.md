# Workout Tracker

A mobile-first PWA-style workout tracker: Library (templates/exercises), Builder
(on-the-fly workouts), Tracker (run a workout with a timer), Log (history + stats).
React + Vite, Tailwind, Dexie (IndexedDB), deployed to GitHub Pages.

## Specs

`specs/01-data-model.md` documents the Dexie schema (Exercise, WorkoutTemplate,
LoggedSession, Settings) and its migration history. `specs/04-tracker.md` documents
the three Tracker timer modes (Open Work, Interval, Pails/Rails) and their Known
Issues/Changelog. Read the relevant spec before changing that area, and update it
as part of the same change - not as a follow-up.

## Conventions

- No comments beyond a short line explaining a non-obvious WHY.
- Session state that must survive navigating away from the Tracker tab lives in
  `src/lib/activeSessionStore.jsx` (an app-level context mounted above the router),
  not in the Tracker page or its child components.
- Pure timer/phase-machine logic lives in `src/lib/sessionEngine.js`, kept free of
  React so it's easy to reason about and test independently of rendering.
- Run `npx oxlint src` and `npm run build` before committing.
