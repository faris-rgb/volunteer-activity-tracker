# ServeTrack — Volunteer Activity Tracker

ServeTrack helps a volunteer organization plan activities, keep a volunteer roster and record who showed up.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, server actions) with React 19
- [Tailwind CSS 4](https://tailwindcss.com)
- [Clerk](https://clerk.com) for sign-in and sign-up
- [Sanity](https://www.sanity.io) as the database for volunteers, activities, attendance, app users and portal settings

## Environment variables

Create a `.env.local` file in the project root with:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key (server only) |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | Sanity project id |
| `NEXT_PUBLIC_SANITY_DATASET` | Sanity dataset, e.g. `production` |
| `SANITY_API_WRITE_TOKEN` | Sanity API token with write access (server only) |
| `OWNER_EMAILS` | Optional, comma-separated. Signed-in users whose verified Clerk email is listed get the owner role (useful after switching Clerk instances) |

Without a Sanity project id the app runs against an in-memory demo store that resets whenever the server restarts.

## Roles

Every signed-in user needs a role before they can use the portal. **The first user who signs in becomes the owner**; everyone after that waits on the "pending role" screen until an owner or admin assigns a role under **Assign Roles**.

| Role | What they can do |
| --- | --- |
| Owner | Everything, including granting the owner role and changing other owners |
| Admin | Everything except managing owners: volunteers, activities, attendance, portal settings and role assignment |
| Staff | Manage volunteers, activities and attendance |
| Volunteer | View the dashboard, activities and attendance (read-only) |

Permissions are enforced on the server for every page and server action; the interface also hides controls a role cannot use.

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in.

Other scripts:

```bash
npm run lint    # ESLint
npm run build   # production build
npm run start   # serve the production build
```

## Sanity schemas

The document schemas live in `src/sanity/schemas`. `sanity/schemas/index.ts` exports the full list for a Sanity Studio (`volunteer`, `activity`, `attendance`, `appUser`, `portalSettings`).
