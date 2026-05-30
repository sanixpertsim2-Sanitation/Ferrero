# SaniExpert Setup Guide

Complete step-by-step guide to set up the SaniExpert application from scratch using Supabase as the backend and Vercel for hosting.

---

## Table of Contents

1. [Create Supabase Project](#step-1-create-supabase-project)
2. [Run Schema](#step-2-run-schema)
3. [Seed Checklist Data](#step-3-seed-checklist-data)
4. [Set Up Storage](#step-4-set-up-storage)
5. [Enable Realtime](#step-5-enable-realtime)
6. [Configure Authentication](#step-6-configure-authentication)
7. [Create Admin User](#step-7-create-admin-user)
8. [Deploy to Vercel](#step-8-deploy-to-vercel)
9. [Set Environment Variables](#step-9-set-environment-variables)
10. [Verify Deployment](#step-10-verify-deployment)

---

## Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign in (or create a free account)
2. Click **"New Project"**
3. Choose your organization (or create one)
4. Fill in the project details:
   - **Name:** `SaniExpert`
   - **Database Password:** Generate a strong password and save it in a password manager
   - **Region:** Choose the region closest to your users (e.g., `North America - East`)
5. Click **"Create new project"**
6. Wait for the project to initialize (this takes 1-2 minutes)

### Get Your API Credentials

1. Once the project is ready, go to the left sidebar and click **Project Settings** (gear icon)
2. Click **API** in the settings menu
3. Copy and save the following values:
   - **Project URL:** `https://xxxxxxxxxxxxxxxxxxxx.supabase.co`
   - **anon/public:** `eyJhbG...` (long JWT string)
   - **service_role:** (keep this secret — only for server-side use)

These will be used as environment variables in your Vercel deployment.

---

## Step 2: Run Schema

1. In the Supabase dashboard, click **SQL Editor** in the left sidebar
2. Click **"New query"**
3. Copy the entire contents of `database/schema.sql` from this repository
4. Paste it into the SQL Editor
5. Click **Run** (or press Ctrl+Enter)

### What this creates:

| # | Table | Purpose |
|---|-------|---------|
| 1 | `clients` | SaniExpert, Ferrero, Give and Go |
| 2 | `facilities` | Production facilities per client |
| 3 | `production_lines` | MACY and other lines with status tracking |
| 4 | `areas` | 5 MACY areas with lock/unlock support |
| 5 | `checklist_templates` | 53 checklist items (pre/post cleaning) |
| 6 | `assignments` | Employee work assignments by shift |
| 7 | `checklist_responses` | YES/NO/N/A + photos + counts |
| 8 | `damage_reports` | Photo-based damage tracking |
| 9 | `findings` | Area lead findings during verification |
| 10 | `area_lead_verifications` | Final area sign-off |
| 11 | `activity_logs` | Audit trail |
| 12 | `profiles` | User role/shift extensions (auth.users) |
| 13 | `auth.users` | Built-in Supabase auth table |

Plus: Row Level Security policies, indexes, 7 triggers, and auto-profile creation on signup.

### Verify schema execution:

Run this query in the SQL Editor to confirm all tables exist:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see 12 tables (plus `auth.users` is internal).

---

## Step 3: Seed Checklist Data

1. Open a **new query** in the SQL Editor
2. Copy the entire contents of `database/seed_macy_checklist_templates.sql`
3. Paste and run it

### What this seeds:

- **Client:** SaniExpert
- **Facility:** Main Plant
- **Production Line:** MACY
- **5 Areas:** MACY Production, MACY Decoration, MACY Oven, MACY Spiral, MACY Palletizing
- **53 Checklist Templates** across all 5 areas

### Verify seed data:

```sql
-- Check areas
SELECT name, sequence_order, status FROM areas ORDER BY sequence_order;

-- Check checklist count per area and phase
SELECT
    areas.name AS area,
    checklist_templates.phase,
    COUNT(*) AS item_count
FROM checklist_templates
JOIN areas ON checklist_templates.area_id = areas.id
GROUP BY areas.name, checklist_templates.phase
ORDER BY areas.name, checklist_templates.phase;
```

Expected: 53 total items across 10 rows (5 areas x 2 phases, with some phases having 0 items).

---

## Step 4: Set Up Storage

1. Open a **new query** in the SQL Editor
2. Copy the contents of `database/setup_storage_rls.sql`
3. Paste and run it

### What this creates:

- A public storage bucket named `verification-photos`
- RLS policies allowing authenticated users to upload, read, and update photos
- Admin-only delete policy for photo cleanup

### Verify storage setup:

1. Go to **Storage** in the left sidebar
2. You should see the `verification-photos` bucket listed
3. Click on it — it should show as Public

---

## Step 5: Enable Realtime

1. Open a **new query** in the SQL Editor
2. Copy the contents of `database/setup_realtime.sql`
3. Paste and run it

### What this enables:

Realtime subscriptions for:
- `production_lines` — live status changes
- `areas` — lock/unlock updates
- `assignments` — assignment changes
- `damage_reports` — new damage reports
- `findings` — finding status changes
- `area_lead_verifications` — verification updates
- `checklist_responses` — checklist progress

### Verify realtime setup:

1. Go to **Database > Replication** in the left sidebar
2. Under the `supabase_realtime` publication, you should see the 7 tables listed

---

## Step 6: Configure Authentication

1. In the Supabase dashboard, click **Authentication** in the left sidebar
2. Click **Providers** in the auth menu
3. Find **Email** in the list and make sure it's enabled
4. Configure settings:
   - **Confirm email:** Toggle OFF for development (or configure SMTP for production confirmation emails)
   - **Secure email change:** ON (recommended)
   - **Mailer OTP Expiration:** 3600 seconds (1 hour)
5. Click **Save**

### Configure Site URL and Redirects

1. Go to **Authentication > URL Configuration**
2. Set **Site URL:** `http://localhost:5173` (for local development)
3. Add redirect URLs:
   - `http://localhost:5173/**`
   - `https://your-app.vercel.app/**` (we'll add the production URL after Vercel deployment)
4. Click **Save**

---

## Step 7: Create Admin User

### Option A: Use the app (Recommended)

1. Start the local app: `npm run dev`
2. Go to `http://localhost:5173`
3. Click **Sign Up** and create an account with email and password
4. Verify the account was created by checking the Supabase dashboard:
   - Go to **Authentication > Users**
   - You should see your new user listed

### Promote to Admin

1. In Supabase SQL Editor, find your user's UUID:

```sql
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 5;
```

2. Copy the UUID from the output
3. Open `database/create_admin.sql` and replace `PASTE_UUID_HERE` with the actual UUID
4. Run the updated query in the SQL Editor

### Verify admin role:

```sql
SELECT id, full_name, role, shift, created_at FROM profiles WHERE role = 'admin';
```

You should see 1 row with `role = 'admin'`.

---

## Step 8: Deploy to Vercel

### Connect Repository

1. Push your code to a Git repository (GitHub, GitLab, or Bitbucket)
2. Go to [https://vercel.com](https://vercel.com) and sign in
3. Click **"Add New Project"**
4. Import your Git repository
5. Vercel will auto-detect the Vite project configuration

### Configure Build Settings

Make sure these settings are correct:

| Setting | Value |
|---------|-------|
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

Click **Deploy** and wait for the build to complete.

---

## Step 9: Set Environment Variables

### In Vercel Dashboard

1. Once deployed, go to your project in the Vercel dashboard
2. Click **Settings > Environment Variables**
3. Add the following variables:

| Variable Name | Value | Source |
|--------------|-------|--------|
| `VITE_SUPABASE_URL` | `https://xxxxxxxxxxxxxxxxxxxx.supabase.co` | Supabase Project Settings > API |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbG...` | Supabase Project Settings > API |
| `VITE_CLOUDINARY_CLOUD_NAME` | Your Cloudinary cloud name | Cloudinary Dashboard |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Your Cloudinary upload preset | Cloudinary Settings > Upload |

4. Click **Save**
5. Trigger a redeploy: Go to **Deployments**, click the three dots on the latest deployment, and select **Redeploy**

### Cloudinary Setup (if not already configured)

1. Go to [https://cloudinary.com](https://cloudinary.com) and create a free account
2. Note your **Cloud Name** from the dashboard
3. Go to **Settings > Upload** and create an **Upload Preset**:
   - Name: `sanexpert_photos` (or your preferred name)
   - Signing Mode: Unsigned
   - Folder: `sanexpert/photos`
4. Save the preset name for your environment variables

---

## Step 10: Verify Deployment

### Test Authentication

1. Go to your Vercel production URL (e.g., `https://sanexpert.vercel.app`)
2. Click **Sign Up** and create a new test account
3. Verify you can log in and the profile is auto-created

### Test Core Features

1. **Dashboard** — Verify the MACY line and all 5 areas are displayed
2. **Area Assignment** — Try locking and unlocking an area
3. **Checklist** — Open a pre-cleaning checklist and submit responses
4. **Damage Report** — Submit a test damage report with a photo
5. **Real-time** — Open the app in two browsers and verify live updates

### Update Supabase Redirect URLs

1. Go back to **Supabase > Authentication > URL Configuration**
2. Add your production URL:
   - `https://your-app.vercel.app/**`
3. Click **Save**

### Common Issues

| Issue | Solution |
|-------|----------|
| "Invalid login credentials" | Check Supabase URL and anon key in environment variables |
| "Bucket not found" | Re-run `setup_storage_rls.sql` in SQL Editor |
| Realtime not working | Verify `setup_realtime.sql` ran successfully |
| RLS policy violation | Check that user has a profile row in the `profiles` table |
| Photos not uploading | Verify Cloudinary credentials and upload preset |

---

## Next Steps

After setup is complete:

1. **Add additional clients** (Ferrero, Give and Go) via the app or SQL
2. **Create employee accounts** for your sanitation team
3. **Assign area_lead and supervisor roles** to team leads
4. **Configure shift schedules** in the app settings
5. **Train staff** on using the digital checklists

---

## Support

For technical issues or questions, contact the development team or refer to the [SaniExpert Implementation Blueprint](SaniExpert_Implementation_Blueprint_v1.0.md).
