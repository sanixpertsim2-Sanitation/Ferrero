# SaniExpert

A Progressive Web Application (PWA) for industrial sanitation management in food manufacturing facilities. Built for SaniExpert to manage cleaning workflows, track production line status, capture damage reports, and verify sanitation completion across MACY and other production lines.

## Overview

SaniExpert digitizes the sanitation workflow for food production facilities. The app manages pre-cleaning and post-cleaning checklists across multiple production areas, tracks employee assignments by shift, handles damage reporting with photo evidence, and provides real-time area status tracking for supervisors and area leads.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + shadcn/ui |
| State Management | Zustand |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| PWA | Vite PWA Plugin (offline support, installable, camera access) |
| Photo Pipeline | Client-side Canvas API + Cloudinary (auto WebP) |
| Hosting | Vercel |

## Features

- **Production Line Management** — Track status of multiple production lines (RAW, CLEANING, RTE, OTHER)
- **Area-based Cleaning Workflows** — 5 distinct MACY areas with pre-cleaning and post-cleaning phases
- **Digital Checklists** — 53 checklist items with YES/NO/N/A responses, photo capture, and count inputs
- **Employee Assignments** — Shift-based assignments (morning, afternoon, night, sunday) with lock/unlock
- **Damage Reports** — Photo-based damage reporting with severity levels and status tracking
- **Area Lead Verification** — Final sign-off process with findings and re-clean triggers
- **Real-time Updates** — Live status board via Supabase Realtime
- **Offline Support** — Full offline functionality with IndexedDB sync queue
- **Photo Compression** — Two-layer compression (Canvas API + Cloudinary) for 94% size reduction
- **Audit Trail** — Complete activity logging for compliance

## Installation

### Prerequisites

- Node.js 18+ and npm
- A Supabase project (free tier works)
- A Cloudinary account (free tier works)
- A Vercel account (for deployment)

### Local Setup

```bash
# Clone the repository
git clone <repo-url>
cd app-sql-docs

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase and Cloudinary credentials

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Environment Variables

Create a `.env.local` file with the following variables:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Cloudinary
VITE_CLOUDINARY_CLOUD_NAME=your-cloud-name
VITE_CLOUDINARY_UPLOAD_PRESET=your-upload-preset
```

## Supabase Setup

### Step 1: Create Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and anon key (Settings > API)
3. Add these to your `.env.local` file

### Step 2: Run Schema

1. Open the Supabase SQL Editor
2. Run the contents of `database/schema.sql` to create all 13 tables with RLS policies, triggers, and indexes

### Step 3: Seed Data

1. Run `database/seed_macy_checklist_templates.sql` to create the MACY client, facility, line, 5 areas, and all 53 checklist items

### Step 4: Storage Setup

1. Run `database/setup_storage_rls.sql` to create the `verification-photos` bucket with RLS policies

### Step 5: Realtime Setup

1. Run `database/setup_realtime.sql` to enable realtime updates for key tables

### Step 6: Authentication

1. Go to Authentication > Providers in Supabase Dashboard
2. Enable Email provider
3. Disable "Confirm email" (or configure SMTP for production)

### Step 7: Create Admin User

1. Sign up your first user through the app
2. Find their UUID: `SELECT id, email FROM auth.users`
3. Run `database/create_admin.sql` with the UUID to grant admin role

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with HMR |
| `npm run build` | Production build with TypeScript checking |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint across the codebase |
| `npm run test` | Run the test suite (Vitest) |

## Project Structure

```
app-sql-docs/
├── database/                          # SQL scripts
│   ├── schema.sql                     # 13 tables, RLS, triggers, indexes
│   ├── seed_macy_checklist_templates.sql  # 53 checklist items + seed data
│   ├── setup_storage_rls.sql          # Storage bucket + RLS policies
│   ├── setup_realtime.sql             # Realtime publication setup
│   └── create_admin.sql               # Admin promotion script
├── public/                            # Static assets, PWA icons, manifest
├── src/
│   ├── components/                    # React components
│   │   ├── ui/                        # shadcn/ui components
│   │   ├── Layout/                    # App shell, navigation
│   │   ├── Dashboard/                 # Status board, line overview
│   │   ├── Areas/                     # Area cards, lock/unlock
│   │   ├── Checklist/                 # Checklist form, items, responses
│   │   ├── DamageReport/            # Damage report form, gallery
│   │   ├── PhotoCapture/            # Camera, compression, upload
│   │   └── Auth/                      # Login, signup, profile
│   ├── hooks/                         # Custom React hooks
│   │   ├── useSupabase.ts             # Supabase client + auth state
│   │   ├── useRealtime.ts           # Realtime subscriptions
│   │   ├── useOfflineSync.ts        # IndexedDB queue + sync
│   │   └── usePhotoCompression.ts   # Canvas API compression
│   ├── stores/                        # Zustand state stores
│   │   ├── authStore.ts             # Auth state + profile
│   │   ├── lineStore.ts             # Production lines + areas
│   │   ├── assignmentStore.ts       # Assignments + checklist
│   │   └── damageStore.ts           # Damage reports
│   ├── lib/                           # Utilities + config
│   │   ├── supabase.ts              # Supabase client setup
│   │   ├── constants.ts             # App constants (shifts, roles)
│   │   └── utils.ts                 # Helper functions
│   ├── types/                         # TypeScript type definitions
│   ├── db/                            # IndexedDB (Dexie) setup
│   └── App.tsx                        # Root component + routing
├── index.html
├── vite.config.ts                     # Vite + PWA plugin config
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## User Roles and Permissions

| Role | Description | Permissions |
|------|-------------|-------------|
| `employee` | Standard sanitation worker | View assigned areas, complete checklists, submit damage reports, view own assignments |
| `area_lead` | Area lead / team lead | All employee permissions + lock/unlock areas, create findings, verify areas, view all assignments |
| `supervisor` | Shift supervisor | All area_lead permissions + manage assignments, view all damage reports, export reports |
| `admin` | System administrator | Full access to all tables and operations, manage users, configure settings |

## Shift Schedule

| Shift | Time | Days |
|-------|------|------|
| Morning | 6:00 AM - 2:00 PM | Monday - Friday |
| Afternoon | 2:00 PM - 10:00 PM | Monday - Friday |
| Night | 10:00 PM - 6:00 AM | Monday - Friday |
| Sunday | 6:00 AM - 2:00 PM | Sunday only |

## Production Line Status

| Status | Description |
|--------|-------------|
| `RAW` | Line is in raw production state, not yet cleaned |
| `CLEANING` | Line is actively being cleaned |
| `RTE` | Ready To Eat — line has passed all verification and is clean |
| `OTHER` | Special status for maintenance, downtime, or other conditions |

## MACY Areas

| # | Area | Checklist Items |
|---|------|----------------|
| 1 | MACY Production | 19 (3 pre + 16 post) |
| 2 | MACY Decoration | 17 (3 pre + 14 post) |
| 3 | MACY Oven | 4 (1 pre + 3 post) |
| 4 | MACY Spiral | 5 (1 pre + 4 post) |
| 5 | MACY Palletizing | 8 (1 pre + 7 post) |

## Deployment

### Deploy to Vercel

1. Push your code to a Git repository (GitHub, GitLab, or Bitbucket)
2. Go to [vercel.com](https://vercel.com) and import your project
3. Configure environment variables in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_CLOUDINARY_CLOUD_NAME`
   - `VITE_CLOUDINARY_UPLOAD_PRESET`
4. Deploy — Vercel will auto-detect the Vite project and build it

### Post-Deployment

1. Add your Vercel production URL to Supabase Auth > URL Configuration:
   - Site URL: `https://your-app.vercel.app`
   - Redirect URLs: `https://your-app.vercel.app/**`
2. Test the deployed app by signing up and logging in
3. Promote your first admin user using `database/create_admin.sql`

## License

Proprietary — SaniExpert Solutions
