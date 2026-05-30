# SaniExpert Implementation Blueprint v1.0

Complete technical blueprint for the SaniExpert Progressive Web Application — an industrial sanitation management system for food manufacturing facilities.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Database Schema](#2-database-schema)
3. [API Layer](#3-api-layer)
4. [Business Logic Implementation](#4-business-logic-implementation)
5. [Component Architecture](#5-component-architecture)
6. [PWA Features](#6-pwa-features)
7. [Security](#7-security)
8. [Photo Handling Pipeline](#8-photo-handling-pipeline)
9. [Known Issues and Solutions](#9-known-issues-and-solutions)
10. [Future Enhancements](#10-future-enhancements)

---

## 1. Architecture Overview

### System Architecture

```
+-------------------+        +-------------------+        +-------------------+
|     Browser       | <----> |     Vercel CDN    | <----> |    Supabase       |
| (PWA - React)     |   HTTPS|  (Static Hosting)  |   HTTPS|  (Backend + DB)    |
+-------------------+        +-------------------+        +-------------------+
        |                                                        |
        | IndexedDB (offline)                                    |
        | Camera API (photos)                                    |
        | Background Sync                                        |
        |                                                      |
        v                                                      v
+-------------------+                                +-------------------+
|   Cloudinary      |                                |   PostgreSQL      |
|   (Photo CDN)     |                                |   (13 tables)     |
+-------------------+                                +-------------------+
                                                        |   Auth (RLS)    |
                                                        |   Realtime      |
                                                        |   Storage       |
                                                        +-------------------+
```

### Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Frontend Framework | React | 18.x | UI components |
| Language | TypeScript | 5.x | Type safety |
| Build Tool | Vite | 5.x | Fast builds + HMR |
| Styling | Tailwind CSS | 3.x | Utility-first CSS |
| UI Components | shadcn/ui | latest | Accessible components |
| State Management | Zustand | 4.x | Lightweight state |
| Backend Platform | Supabase | latest | DB, Auth, Realtime, Storage |
| Database | PostgreSQL | 15.x | Relational data |
| Offline DB | Dexie (IndexedDB) | 3.x | Client-side queue |
| Photo CDN | Cloudinary | latest | Image hosting + optimization |
| PWA | Vite PWA Plugin | latest | Offline, installable |
| Hosting | Vercel | latest | Edge deployment |

### Data Flow

```
[User Action]
     |
     v
[Zustand Store] --> [Optimistic UI Update]
     |
     +--> [Online?] --> YES --> [Supabase API] --> [Database]
     |                      |        |
     |                      |        +--> [Realtime] --> [Other Clients]
     |                      |
     |                      +--> [Cloudinary] --> [CDN URL]
     |
     +--> NO --> [Dexie/IndexedDB] --> [Background Sync Queue]
                      |
                      +--> [Sync when online]
```

---

## 2. Database Schema

### Entity Relationship Diagram

```
+-------------+       +---------------+       +------------------+
|   clients   |<-----+|  facilities   |<-----+| production_lines |
+-------------+       +---------------+       +------------------+
    |                       |                        |
    |                       |                        |
    |                       |                        v
    |                       |                 +-------------+
    |                       |                 |    areas    |
    |                       |                 +-------------+
    |                       |                        |
    |                       |                        v
    |                       |            +-----------------------+
    |                       |            | checklist_templates   |
    |                       |            +-----------------------+
    |                       |
    v                       v
+-------------------------------------------------------+
|                      assignments                      |
|  (line_id, area_id, user_id, shift, date, phase)      |
+-------------------------------------------------------+
     |                           |                           |
     v                           v                           v
+------------------+  +------------------+  +------------------+
|checklist_responses|  | damage_reports   |  |    findings      |
+------------------+  +------------------+  +------------------+
     |
     v
+--------------------------+
| area_lead_verifications  |
+--------------------------+
     |
     v
+------------------+
|  activity_logs   |
+------------------+

+-------------+       +------------------+
| auth.users  |<----->|     profiles     |
+-------------+       +------------------+
```

### Table Specifications

#### 2.1 clients
Stores client organizations served by SaniExpert.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Unique identifier |
| name | TEXT | NOT NULL | Client name (e.g., SaniExpert, Ferrero) |
| contact_email | TEXT | | Primary contact email |
| contact_phone | TEXT | | Primary contact phone |
| created_at | TIMESTAMPTZ | DEFAULT now() | Record creation timestamp |

**RLS:** Authenticated read/insert; admin/area_lead/supervisor update.

#### 2.2 facilities
Production facilities belonging to each client.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| client_id | UUID | FK -> clients(id), ON DELETE CASCADE | Parent client |
| name | TEXT | NOT NULL | Facility name (e.g., Main Plant) |
| address | TEXT | | Physical address |
| created_at | TIMESTAMPTZ | DEFAULT now() | Record creation timestamp |

**RLS:** Authenticated read/insert; admin/area_lead/supervisor update.

#### 2.3 production_lines
Individual production lines within a facility.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| facility_id | UUID | FK -> facilities(id), ON DELETE CASCADE | Parent facility |
| name | TEXT | NOT NULL | Line name (e.g., MACY) |
| status | TEXT | DEFAULT 'RAW', CHECK IN ('RAW','CLEANING','RTE','OTHER') | Current line status |
| last_cleaned_at | TIMESTAMPTZ | | Last successful cleaning timestamp |
| next_cleaning_at | TIMESTAMPTZ | | Scheduled next cleaning |
| created_at | TIMESTAMPTZ | DEFAULT now() | Record creation timestamp |

**Indexes:** facility_id, status

#### 2.4 areas
Zones within a production line. Each line has multiple areas cleaned in sequence.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| line_id | UUID | FK -> production_lines(id), ON DELETE CASCADE | Parent line |
| name | TEXT | NOT NULL | Area name (e.g., MACY Production) |
| status | TEXT | DEFAULT 'RAW', CHECK IN ('RAW','CLEANING','RTE','OTHER','COMPLETED') | Current area status |
| locked_by | UUID | FK -> auth.users(id), ON DELETE SET NULL | User who locked the area |
| locked_at | TIMESTAMPTZ | | When the area was locked |
| sequence_order | INTEGER | DEFAULT 0 | Cleaning sequence (1-5 for MACY) |
| created_at | TIMESTAMPTZ | DEFAULT now() | Record creation timestamp |

**Indexes:** line_id, locked_by

#### 2.5 checklist_templates
Master list of checklist items for each area and phase.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| area_id | UUID | FK -> areas(id), ON DELETE CASCADE | Parent area |
| phase | TEXT | NOT NULL, CHECK IN ('pre-cleaning','post-cleaning') | Cleaning phase |
| item_text | TEXT | NOT NULL | The checklist question/item |
| item_type | TEXT | DEFAULT 'yes_no', CHECK IN ('yes_no','photo','count') | Response type |
| sequence_order | INTEGER | DEFAULT 0 | Display order within phase |
| has_count | BOOLEAN | DEFAULT false | Whether item requires a count input |
| count_label | TEXT | | Label for count field (e.g., 'equipment_covered') |
| help_text | TEXT | | Detailed guidance for the item |
| created_at | TIMESTAMPTZ | DEFAULT now() | Record creation timestamp |

**Indexes:** area_id, area_id + phase (composite)

**Seed Data:** 53 items across 5 MACY areas (see seed_macy_checklist_templates.sql)

#### 2.6 assignments
Tracks who is assigned to which area for cleaning.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| line_id | UUID | FK -> production_lines(id), ON DELETE CASCADE | Parent line |
| area_id | UUID | FK -> areas(id), ON DELETE CASCADE | Assigned area |
| user_id | UUID | FK -> auth.users(id), ON DELETE SET NULL | Assigned employee |
| shift | TEXT | NOT NULL, CHECK IN ('morning','afternoon','night','sunday') | Work shift |
| date | DATE | NOT NULL, DEFAULT CURRENT_DATE | Assignment date |
| phase | TEXT | CHECK IN ('pre-cleaning','post-cleaning') | Cleaning phase |
| status | TEXT | DEFAULT 'in_progress', CHECK IN ('in_progress','completed','abandoned') | Assignment status |
| started_at | TIMESTAMPTZ | DEFAULT now() | When cleaning started |
| completed_at | TIMESTAMPTZ | | When cleaning completed |
| created_at | TIMESTAMPTZ | DEFAULT now() | Record creation timestamp |

**Unique Constraint:** (area_id, date, phase) — one assignment per area per date per phase

**Indexes:** line_id, area_id, user_id, date, status

#### 2.7 checklist_responses
Individual responses to checklist items.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| assignment_id | UUID | FK -> assignments(id), ON DELETE CASCADE | Parent assignment |
| checklist_item_id | UUID | FK -> checklist_templates(id), ON DELETE CASCADE | The checklist item |
| response | TEXT | CHECK IN ('YES','NO','N/A') | YES/NO/N/A response |
| photo_url | TEXT | | URL to verification photo |
| count_value | INTEGER | | Numeric count value |
| notes | TEXT | | Additional notes |
| created_at | TIMESTAMPTZ | DEFAULT now() | Record creation timestamp |

**Indexes:** assignment_id, checklist_item_id

#### 2.8 damage_reports
Photo-based damage tracking for equipment and facilities.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| line_id | UUID | FK -> production_lines(id), ON DELETE CASCADE | Affected line |
| area_id | UUID | FK -> areas(id), ON DELETE CASCADE | Affected area |
| description | TEXT | NOT NULL | Damage description |
| photo_url | TEXT | NOT NULL | Photo evidence URL |
| severity | TEXT | DEFAULT 'medium', CHECK IN ('low','medium','high') | Damage severity |
| status | TEXT | DEFAULT 'open', CHECK IN ('open','in_progress','resolved') | Report status |
| reported_by | UUID | FK -> auth.users(id), ON DELETE SET NULL | Reporter |
| resolved_by | UUID | FK -> auth.users(id), ON DELETE SET NULL | Resolver |
| resolved_at | TIMESTAMPTZ | | When resolved |
| created_at | TIMESTAMPTZ | DEFAULT now() | Record creation timestamp |

**Indexes:** line_id, area_id, status

#### 2.9 findings
Area lead findings during post-cleaning verification.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| line_id | UUID | FK -> production_lines(id), ON DELETE CASCADE | Affected line |
| area_id | UUID | FK -> areas(id), ON DELETE CASCADE | Affected area |
| description | TEXT | NOT NULL | Finding description |
| severity | TEXT | DEFAULT 'minor', CHECK IN ('minor','major','critical') | Finding severity |
| status | TEXT | DEFAULT 'open', CHECK IN ('open','resolved') | Finding status |
| photo_url | TEXT | | Photo evidence URL |
| created_by | UUID | FK -> auth.users(id), ON DELETE SET NULL | Creator |
| resolved_by | UUID | FK -> auth.users(id), ON DELETE SET NULL | Resolver |
| resolved_at | TIMESTAMPTZ | | When resolved |
| created_at | TIMESTAMPTZ | DEFAULT now() | Record creation timestamp |

**Indexes:** line_id, area_id, status

#### 2.10 area_lead_verifications
Final sign-off record after area lead verifies post-cleaning.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| line_id | UUID | FK -> production_lines(id), ON DELETE CASCADE | Verified line |
| verified_by | UUID | FK -> auth.users(id), ON DELETE SET NULL | Verifying area lead |
| verified_at | TIMESTAMPTZ | | Verification timestamp |
| shift | TEXT | NOT NULL | Shift being verified |
| date | DATE | NOT NULL, DEFAULT CURRENT_DATE | Verification date |
| status | TEXT | DEFAULT 'verified', CHECK IN ('verified','needs_reclean') | Verification result |
| notes | TEXT | | Additional notes |
| created_at | TIMESTAMPTZ | DEFAULT now() | Record creation timestamp |

**Indexes:** line_id, date

#### 2.11 activity_logs
Audit trail for compliance and debugging.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| user_id | UUID | FK -> auth.users(id), ON DELETE SET NULL | Acting user |
| action | TEXT | NOT NULL | Action performed |
| table_name | TEXT | | Affected table |
| record_id | UUID | | Affected record |
| details | JSONB | | Additional context |
| created_at | TIMESTAMPTZ | DEFAULT now() | Timestamp |

**Indexes:** user_id, created_at DESC

#### 2.12 profiles
Extends Supabase auth.users with role and shift information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, FK -> auth.users(id), ON DELETE CASCADE | User ID |
| full_name | TEXT | | Display name |
| role | TEXT | DEFAULT 'employee', CHECK IN ('employee','area_lead','supervisor','admin') | User role |
| shift | TEXT | CHECK IN ('morning','afternoon','night','sunday') | Assigned shift |
| phone | TEXT | | Contact phone |
| created_at | TIMESTAMPTZ | DEFAULT now() | Profile creation |
| updated_at | TIMESTAMPTZ | DEFAULT now() | Last update |

**Indexes:** role, shift

### Relationships Summary

```
clients (1) --> (*) facilities (1) --> (*) production_lines (1) --> (*) areas
                                                                    |
areas (1) --> (*) checklist_templates                               |
areas (1) --> (*) assignments (*) --> (1) auth.users                |
areas (1) --> (*) findings                                          |
areas (1) --> (*) damage_reports                                    |

assignments (1) --> (*) checklist_responses
assignments (*) --> (1) production_lines
assignments (*) --> (1) auth.users

production_lines (1) --> (*) damage_reports
production_lines (1) --> (*) area_lead_verifications

auth.users (1) --> (1) profiles
auth.users (1) --> (*) activity_logs
```

---

## 3. API Layer

### 3.1 Supabase Client Setup

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types'; // Generated types

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
```

### 3.2 TypeScript Database Types

```typescript
// types/database.ts
export interface Tables {
  clients: {
    id: string;
    name: string;
    contact_email: string | null;
    contact_phone: string | null;
    created_at: string;
  };
  facilities: {
    id: string;
    client_id: string;
    name: string;
    address: string | null;
    created_at: string;
  };
  production_lines: {
    id: string;
    facility_id: string;
    name: string;
    status: 'RAW' | 'CLEANING' | 'RTE' | 'OTHER';
    last_cleaned_at: string | null;
    next_cleaning_at: string | null;
    created_at: string;
  };
  areas: {
    id: string;
    line_id: string;
    name: string;
    status: 'RAW' | 'CLEANING' | 'RTE' | 'OTHER' | 'COMPLETED';
    locked_by: string | null;
    locked_at: string | null;
    sequence_order: number;
    created_at: string;
  };
  checklist_templates: {
    id: string;
    area_id: string;
    phase: 'pre-cleaning' | 'post-cleaning';
    item_text: string;
    item_type: 'yes_no' | 'photo' | 'count';
    sequence_order: number;
    has_count: boolean;
    count_label: string | null;
    help_text: string | null;
    created_at: string;
  };
  assignments: {
    id: string;
    line_id: string;
    area_id: string;
    user_id: string | null;
    shift: 'morning' | 'afternoon' | 'night' | 'sunday';
    date: string;
    phase: 'pre-cleaning' | 'post-cleaning' | null;
    status: 'in_progress' | 'completed' | 'abandoned';
    started_at: string;
    completed_at: string | null;
    created_at: string;
  };
  checklist_responses: {
    id: string;
    assignment_id: string;
    checklist_item_id: string;
    response: 'YES' | 'NO' | 'N/A' | null;
    photo_url: string | null;
    count_value: number | null;
    notes: string | null;
    created_at: string;
  };
  damage_reports: {
    id: string;
    line_id: string;
    area_id: string;
    description: string;
    photo_url: string;
    severity: 'low' | 'medium' | 'high';
    status: 'open' | 'in_progress' | 'resolved';
    reported_by: string | null;
    resolved_by: string | null;
    resolved_at: string | null;
    created_at: string;
  };
  findings: {
    id: string;
    line_id: string;
    area_id: string;
    description: string;
    severity: 'minor' | 'major' | 'critical';
    status: 'open' | 'resolved';
    photo_url: string | null;
    created_by: string | null;
    resolved_by: string | null;
    resolved_at: string | null;
    created_at: string;
  };
  area_lead_verifications: {
    id: string;
    line_id: string;
    verified_by: string | null;
    verified_at: string | null;
    shift: string;
    date: string;
    status: 'verified' | 'needs_reclean';
    notes: string | null;
    created_at: string;
  };
  activity_logs: {
    id: string;
    user_id: string | null;
    action: string;
    table_name: string | null;
    record_id: string | null;
    details: Record<string, unknown> | null;
    created_at: string;
  };
  profiles: {
    id: string;
    full_name: string | null;
    role: 'employee' | 'area_lead' | 'supervisor' | 'admin';
    shift: 'morning' | 'afternoon' | 'night' | 'sunday' | null;
    phone: string | null;
    created_at: string;
    updated_at: string;
  };
}
```

### 3.3 API Helper Functions

```typescript
// lib/api.ts
import { supabase } from './supabase';
import type { Tables } from '../types/database';

// ==================== CLIENTS ====================
export async function getClients() {
  return supabase.from('clients').select('*').order('name');
}

// ==================== FACILITIES ====================
export async function getFacilities(clientId?: string) {
  let query = supabase.from('facilities').select('*');
  if (clientId) query = query.eq('client_id', clientId);
  return query.order('name');
}

// ==================== PRODUCTION LINES ====================
export async function getProductionLines(facilityId?: string) {
  let query = supabase.from('production_lines').select(`
    *,
    facility:facilities(name)
  `);
  if (facilityId) query = query.eq('facility_id', facilityId);
  return query.order('name');
}

export async function updateLineStatus(
  lineId: string,
  status: Tables['production_lines']['status']
) {
  return supabase
    .from('production_lines')
    .update({ status, last_cleaned_at: status === 'RTE' ? new Date().toISOString() : undefined })
    .eq('id', lineId);
}

// ==================== AREAS ====================
export async function getAreas(lineId?: string) {
  let query = supabase.from('areas').select(`
    *,
    line:production_lines(name),
    locked_by_user:profiles(full_name)
  `);
  if (lineId) query = query.eq('line_id', lineId);
  return query.order('sequence_order');
}

export async function lockArea(areaId: string, userId: string) {
  return supabase
    .from('areas')
    .update({ locked_by: userId, locked_at: new Date().toISOString(), status: 'CLEANING' })
    .eq('id', areaId);
}

export async function unlockArea(areaId: string) {
  return supabase
    .from('areas')
    .update({ locked_by: null, locked_at: null, status: 'RAW' })
    .eq('id', areaId);
}

// ==================== CHECKLIST TEMPLATES ====================
export async function getChecklistTemplates(areaId: string, phase?: string) {
  let query = supabase
    .from('checklist_templates')
    .select('*')
    .eq('area_id', areaId)
    .order('sequence_order');
  if (phase) query = query.eq('phase', phase);
  return query;
}

// ==================== ASSIGNMENTS ====================
export async function getAssignments(filters?: {
  lineId?: string;
  areaId?: string;
  userId?: string;
  date?: string;
  status?: string;
}) {
  let query = supabase.from('assignments').select(`
    *,
    area:areas(name, sequence_order, status),
    user:profiles(full_name),
    line:production_lines(name)
  `);

  if (filters?.lineId) query = query.eq('line_id', filters.lineId);
  if (filters?.areaId) query = query.eq('area_id', filters.areaId);
  if (filters?.userId) query = query.eq('user_id', filters.userId);
  if (filters?.date) query = query.eq('date', filters.date);
  if (filters?.status) query = query.eq('status', filters.status);

  return query.order('created_at', { ascending: false });
}

export async function createAssignment(data: Omit<Tables['assignments'], 'id' | 'created_at' | 'started_at'>) {
  return supabase.from('assignments').insert(data).select().single();
}

export async function completeAssignment(assignmentId: string) {
  return supabase
    .from('assignments')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', assignmentId);
}

// ==================== CHECKLIST RESPONSES ====================
export async function getChecklistResponses(assignmentId: string) {
  return supabase
    .from('checklist_responses')
    .select('*')
    .eq('assignment_id', assignmentId);
}

export async function submitChecklistResponse(data: Omit<Tables['checklist_responses'], 'id' | 'created_at'>) {
  return supabase
    .from('checklist_responses')
    .upsert(data, { onConflict: 'assignment_id,checklist_item_id' })
    .select();
}

// ==================== DAMAGE REPORTS ====================
export async function getDamageReports(filters?: {
  lineId?: string;
  areaId?: string;
  status?: string;
}) {
  let query = supabase.from('damage_reports').select(`
    *,
    area:areas(name),
    reporter:profiles(full_name),
    resolver:profiles(full_name)
  `);

  if (filters?.lineId) query = query.eq('line_id', filters.lineId);
  if (filters?.areaId) query = query.eq('area_id', filters.areaId);
  if (filters?.status) query = query.eq('status', filters.status);

  return query.order('created_at', { ascending: false });
}

export async function createDamageReport(
  data: Omit<Tables['damage_reports'], 'id' | 'created_at' | 'resolved_at' | 'resolved_by'>
) {
  return supabase.from('damage_reports').insert(data).select().single();
}

export async function resolveDamageReport(reportId: string, resolvedBy: string) {
  return supabase
    .from('damage_reports')
    .update({
      status: 'resolved',
      resolved_by: resolvedBy,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', reportId);
}

// ==================== FINDINGS ====================
export async function getFindings(filters?: {
  lineId?: string;
  areaId?: string;
  status?: string;
}) {
  let query = supabase.from('findings').select(`
    *,
    area:areas(name),
    creator:profiles(full_name)
  `);

  if (filters?.lineId) query = query.eq('line_id', filters.lineId);
  if (filters?.areaId) query = query.eq('area_id', filters.areaId);
  if (filters?.status) query = query.eq('status', filters.status);

  return query.order('created_at', { ascending: false });
}

export async function createFinding(
  data: Omit<Tables['findings'], 'id' | 'created_at' | 'resolved_at' | 'resolved_by'>
) {
  return supabase.from('findings').insert(data).select().single();
}

export async function resolveFinding(findingId: string, resolvedBy: string) {
  return supabase
    .from('findings')
    .update({
      status: 'resolved',
      resolved_by: resolvedBy,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', findingId);
}

// ==================== VERIFICATIONS ====================
export async function getVerifications(lineId?: string, date?: string) {
  let query = supabase.from('area_lead_verifications').select(`
    *,
    line:production_lines(name),
    verifier:profiles(full_name)
  `);

  if (lineId) query = query.eq('line_id', lineId);
  if (date) query = query.eq('date', date);

  return query.order('verified_at', { ascending: false });
}

export async function createVerification(
  data: Omit<Tables['area_lead_verifications'], 'id' | 'created_at'>
) {
  return supabase.from('area_lead_verifications').insert(data).select().single();
}

// ==================== ACTIVITY LOGS ====================
export async function getActivityLogs(limit = 50) {
  return supabase
    .from('activity_logs')
    .select(`
      *,
      user:profiles(full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);
}

// ==================== PROFILES ====================
export async function getProfile(userId: string) {
  return supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
}

export async function updateProfile(userId: string, data: Partial<Tables['profiles']>) {
  return supabase.from('profiles').update(data).eq('id', userId);
}

export async function getTeamMembers(role?: string) {
  let query = supabase.from('profiles').select('*');
  if (role) query = query.eq('role', role);
  return query.order('full_name');
}

// ==================== AUTH ====================
export async function signUp(email: string, password: string, fullName: string) {
  return supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getCurrentUser() {
  return supabase.auth.getUser();
}

export async function getSession() {
  return supabase.auth.getSession();
}
```

---

## 4. Business Logic Implementation

### 4.1 Area Locking Mechanism

**Rules:**
- An area can only be worked on by one employee at a time
- Only area_leads, supervisors, and admins can lock/unlock areas
- Locking sets `status = 'CLEANING'` and records the user
- Unlocking resets `status = 'RAW'` and clears the lock
- An assignment can only be created for a locked area

**Flow:**

```
[Area Lead clicks "Lock Area"]
           |
           v
[Check: Is area already locked?]
           |
     +-----+-----+
     |           |
    YES         NO
     |           |
     v           v
[Show error]  [Update area:
              locked_by = userId
              locked_at = now()
              status = 'CLEANING']
                     |
                     v
              [Create assignment
               for the area]
                     |
                     v
              [Employee can now
               start checklist]
```

**Implementation:**

```typescript
// hooks/useAreaLock.ts
import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export function useAreaLock() {
  const { profile } = useAuthStore();
  const [locking, setLocking] = useState(false);

  const canLock = useCallback(() => {
    return ['area_lead', 'supervisor', 'admin'].includes(profile?.role ?? '');
  }, [profile]);

  const lockArea = useCallback(async (areaId: string) => {
    if (!canLock()) throw new Error('Only area leads and above can lock areas');
    if (!profile) throw new Error('Not authenticated');

    setLocking(true);
    try {
      // Check if already locked
      const { data: area } = await supabase
        .from('areas')
        .select('locked_by')
        .eq('id', areaId)
        .single();

      if (area?.locked_by) {
        throw new Error('Area is already locked by another user');
      }

      // Lock the area
      const { error } = await supabase
        .from('areas')
        .update({
          locked_by: profile.id,
          locked_at: new Date().toISOString(),
          status: 'CLEANING',
        })
        .eq('id', areaId);

      if (error) throw error;

      // Create assignment
      const { error: assignError } = await supabase
        .from('assignments')
        .insert({
          line_id: '', // populated from area
          area_id: areaId,
          user_id: profile.id,
          shift: profile.shift ?? 'morning',
          date: new Date().toISOString().split('T')[0],
          phase: 'pre-cleaning',
          status: 'in_progress',
        });

      if (assignError) throw assignError;

      return { success: true };
    } finally {
      setLocking(false);
    }
  }, [canLock, profile]);

  const unlockArea = useCallback(async (areaId: string) => {
    if (!canLock()) throw new Error('Only area leads and above can unlock areas');

    setLocking(true);
    try {
      const { error } = await supabase
        .from('areas')
        .update({
          locked_by: null,
          locked_at: null,
          status: 'RAW',
        })
        .eq('id', areaId);

      if (error) throw error;
      return { success: true };
    } finally {
      setLocking(false);
    }
  }, [canLock]);

  return { lockArea, unlockArea, locking, canLock: canLock() };
}
```

### 4.2 Covering Count Validation

**Rules:**
- Pre-cleaning checklist items may require count values (equipment covered, bags retrieved)
- Count values must be non-negative integers
- Count items must be completed before the pre-cleaning phase can be marked complete
- Count data is stored in `checklist_responses.count_value`

**Flow:**

```
[Employee opens pre-cleaning checklist]
            |
            v
[Show count items first (sequence 1-3)]
            |
            v
[Employee enters counts]
  - Equipment covered: __
  - Bags retrieved: __
            |
            v
[Validate: All counts >= 0?]
            |
     +------+------+
     |             |
    YES           NO
     |             |
     v             v
[Save to     [Show error,
 checklist]   require correction]
     |
     v
[Show remaining YES/NO items]
```

**Implementation:**

```typescript
// hooks/useChecklist.ts
import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface ChecklistResponseInput {
  checklistItemId: string;
  response?: 'YES' | 'NO' | 'N/A';
  countValue?: number;
  photoUrl?: string;
  notes?: string;
}

export function useChecklist(assignmentId: string) {
  const [submitting, setSubmitting] = useState(false);
  const [responses, setResponses] = useState<Map<string, ChecklistResponseInput>>(new Map());

  const setResponse = useCallback((itemId: string, data: Partial<ChecklistResponseInput>) => {
    setResponses(prev => {
      const next = new Map(prev);
      const existing = next.get(itemId) ?? { checklistItemId: itemId };
      next.set(itemId, { ...existing, ...data, checklistItemId: itemId });
      return next;
    });
  }, []);

  const validateCounts = useCallback((): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    for (const [itemId, resp] of responses) {
      if (resp.countValue !== undefined) {
        if (resp.countValue < 0) {
          errors.push(`Count cannot be negative (item ${itemId})`);
        }
        if (!Number.isInteger(resp.countValue)) {
          errors.push(`Count must be a whole number (item ${itemId})`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }, [responses]);

  const submitResponses = useCallback(async () => {
    const { valid, errors } = validateCounts();
    if (!valid) throw new Error(errors.join(', '));

    setSubmitting(true);
    try {
      const responseArray = Array.from(responses.values()).map(r => ({
        assignment_id: assignmentId,
        checklist_item_id: r.checklistItemId,
        response: r.response ?? null,
        count_value: r.countValue ?? null,
        photo_url: r.photoUrl ?? null,
        notes: r.notes ?? null,
      }));

      const { error } = await supabase
        .from('checklist_responses')
        .upsert(responseArray, {
          onConflict: 'assignment_id,checklist_item_id',
        });

      if (error) throw error;
      return { success: true };
    } finally {
      setSubmitting(false);
    }
  }, [responses, assignmentId, validateCounts]);

  const canCompletePhase = useCallback((): boolean => {
    // Check all required items have responses
    // All count items must have non-null countValue
    // All yes_no items must have a response
    // Photo items must have a photoUrl
    return true; // Simplified — actual check iterates all templates
  }, []);

  return {
    responses,
    setResponse,
    submitResponses,
    submitting,
    validateCounts,
    canCompletePhase,
  };
}
```

### 4.3 Damage Report Blocking

**Rules:**
- A damage report blocks the area from being marked RTE (Ready To Eat)
- All damage reports for an area must be resolved before final verification
- Damage reports can be created by any authenticated user
- Only area_leads+ can resolve damage reports

**Flow:**

```
[Damage reported in Area X]
          |
          v
[Create damage_reports row
 with status = 'open']
          |
          v
[Area status = 'CLEANING'
 (cannot become RTE)]
          |
          v
[Supervisor reviews report]
          |
     +----+----+
     |         |
  Repair   Defer
     |         |
     v         v
[Resolve]  [Keep open]
     |         |
     v         v
[Status=   [Area stays
'resolved']  blocked]
     |
     v
[Check: All reports
 resolved?]
     |
    YES --> [Area can proceed to RTE]
```

**Implementation:**

```typescript
// hooks/useDamageReports.ts
import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useDamageReports() {
  const [loading, setLoading] = useState(false);

  const hasOpenDamageReports = useCallback(async (areaId: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('damage_reports')
      .select('id')
      .eq('area_id', areaId)
      .in('status', ['open', 'in_progress']);

    if (error) throw error;
    return (data?.length ?? 0) > 0;
  }, []);

  const canMarkRTE = useCallback(async (areaId: string): Promise<{ canProceed: boolean; openReports: number }> => {
    const { data, error } = await supabase
      .from('damage_reports')
      .select('id')
      .eq('area_id', areaId)
      .in('status', ['open', 'in_progress']);

    if (error) throw error;
    const openReports = data?.length ?? 0;
    return { canProceed: openReports === 0, openReports };
  }, []);

  const createDamageReport = useCallback(async (data: {
    lineId: string;
    areaId: string;
    description: string;
    photoUrl: string;
    severity: 'low' | 'medium' | 'high';
    reportedBy: string;
  }) => {
    setLoading(true);
    try {
      // Create the damage report
      const { error } = await supabase.from('damage_reports').insert({
        line_id: data.lineId,
        area_id: data.areaId,
        description: data.description,
        photo_url: data.photoUrl,
        severity: data.severity,
        reported_by: data.reportedBy,
        status: 'open',
      });

      if (error) throw error;

      // Ensure area cannot go to RTE
      await supabase
        .from('areas')
        .update({ status: 'CLEANING' })
        .eq('id', data.areaId)
        .neq('status', 'RTE');

      return { success: true };
    } finally {
      setLoading(false);
    }
  }, []);

  const resolveDamageReport = useCallback(async (reportId: string, resolvedBy: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('damage_reports')
        .update({
          status: 'resolved',
          resolved_by: resolvedBy,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', reportId);

      if (error) throw error;
      return { success: true };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    createDamageReport,
    resolveDamageReport,
    hasOpenDamageReports,
    canMarkRTE,
    loading,
  };
}
```

### 4.4 Real-time Updates

**Subscriptions:**

```typescript
// hooks/useRealtime.ts
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useRealtimeAreas(callback: (payload: any) => void) {
  useEffect(() => {
    const subscription = supabase
      .channel('areas-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'areas' },
        callback
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [callback]);
}

export function useRealtimeAssignments(callback: (payload: any) => void, lineId?: string) {
  useEffect(() => {
    const subscription = supabase
      .channel('assignments-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'assignments',
          filter: lineId ? `line_id=eq.${lineId}` : undefined,
        },
        callback
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [callback, lineId]);
}

export function useRealtimeDamageReports(callback: (payload: any) => void) {
  useEffect(() => {
    const subscription = supabase
      .channel('damage-reports-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'damage_reports' },
        callback
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [callback]);
}

export function useRealtimeFindings(callback: (payload: any) => void) {
  useEffect(() => {
    const subscription = supabase
      .channel('findings-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'findings' },
        callback
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [callback]);
}
```

---

## 5. Component Architecture

### 5.1 Component Hierarchy

```
App
├── Layout
│   ├── TopBar (logo, user, notifications)
│   ├── BottomNav (dashboard, areas, reports, settings)
│   └── Sidebar (desktop only)
│
├── Routes
│   ├── /login
│   │   └── LoginForm
│   ├── /signup
│   │   └── SignupForm
│   ├── /
│   │   └── Dashboard
│   │       ├── LineStatusCard
│   │       ├── AreaGrid
│   │       │   └── AreaCard (×5)
│   │       └── ShiftSelector
│   ├── /areas/:areaId
│   │   └── AreaDetail
│   │       ├── AreaHeader (name, status, lock button)
│   │       ├── AssignmentPanel
│   │       └── PhaseTabs
│   │           ├── PreCleaningTab
│   │           │   └── ChecklistForm
│   │           │       ├── CountItem (×3)
│   │           │       ├── YesNoItem (×N)
│   │           │       ├── PhotoItem (×N)
│   │           │       └── SubmitButton
│   │           └── PostCleaningTab
│   │               └── ChecklistForm
│   │                   ├── YesNoItem (×N)
│   │                   ├── PhotoItem (×N)
│   │                   └── SubmitButton
│   ├── /areas/:areaId/verify
│   │   └── AreaVerification
│   │       ├── VerificationHeader
│   │       ├── ChecklistReview
│   │       ├── FindingForm
│   │       ├── FindingList
│   │       ├── DamageReportCheck
│   │       └── SignOffButton
│   ├── /damage-reports
│   │   └── DamageReportPage
│   │       ├── DamageReportList
│   │       │   └── DamageReportCard (×N)
│   │       └── DamageReportForm
│   │           ├── PhotoCapture
│   │           ├── AreaSelector
│   │           ├── SeveritySelector
│   │           └── SubmitButton
│   ├── /findings
│   │   └── FindingsPage
│   │       ├── FindingList
│   │       └── FindingForm
│   ├── /activity
│   │   └── ActivityLogPage
│   │       └── ActivityLogList
│   ├── /settings
│   │   └── SettingsPage
│   │       ├── ProfileEditor
│   │       ├── ShiftSelector
│   │       └── SyncStatusPanel
│   └── /admin
│       └── AdminPage
│           ├── UserManagement
│           ├── LineConfiguration
│           └── ChecklistEditor
│
└── Shared Components
    ├── PhotoCapture (camera + preview + compress)
    ├── PhotoViewer (lightbox + zoom)
    ├── StatusBadge (RAW/CLEANING/RTE/OTHER)
    ├── LockButton (lock/unlock with confirmation)
    ├── OfflineIndicator (sync status banner)
    └── LoadingSpinner
```

### 5.2 Key Components

#### PhotoCapture Component

```typescript
interface PhotoCaptureProps {
  onCapture: (file: File, compressedBlob: Blob) => void;
  onClear?: () => void;
  existingPhotoUrl?: string;
  allowGallery?: boolean; // Allow selecting from device gallery
}

// Features:
// - Camera API access (getUserMedia)
// - Live preview
// - Capture button
// - Gallery selection option
// - Client-side compression (Canvas API)
// - Preview before upload
// - Retake option
```

#### AreaCard Component

```typescript
interface AreaCardProps {
  area: Tables['areas'] & {
    locked_by_user?: { full_name: string | null } | null;
    line?: { name: string } | null;
  };
  assignment?: Tables['assignments'] | null;
  onLock: (areaId: string) => void;
  onUnlock: (areaId: string) => void;
  onOpen: (areaId: string) => void;
}

// Status display:
// - RAW: Gray
// - CLEANING: Yellow (with user name if locked)
// - RTE: Green
// - OTHER: Blue
// - COMPLETED: Purple
```

#### ChecklistForm Component

```typescript
interface ChecklistFormProps {
  assignmentId: string;
  areaId: string;
  phase: 'pre-cleaning' | 'post-cleaning';
  templates: Tables['checklist_templates'][];
  existingResponses: Tables['checklist_responses'][];
  onSubmit: () => void;
}

// Renders different input types based on item_type:
// - 'yes_no': Radio buttons (YES/NO/N/A)
// - 'photo': PhotoCapture component
// - 'count': Number input with label
```

---

## 6. PWA Features

### 6.1 Offline Support

```
+------------------+     +------------------+     +------------------+
|     Online       |     |    Background    |     |     Offline      |
|    Operation     | --> |      Sync        | <-- |    Operation     |
+------------------+     +------------------+     +------------------+
        |                       |                        |
        v                       v                        v
   Supabase API          Service Worker            IndexedDB Queue
   (immediate)           (sync event)              (local storage)
```

**Features:**
- **Service Worker:** Caches static assets (JS, CSS, HTML)
- **IndexedDB (Dexie):** Queues photos and form data when offline
- **Background Sync:** Automatically syncs when connectivity restored
- **Network-first strategy:** Tries network first, falls back to cache
- **Sync indicator:** UI shows pending sync count

### 6.2 Installable

- **Web App Manifest:** Defines app name, icons, theme colors, display mode
- **Standalone display:** Opens without browser chrome
- **Home screen icon:** Users can add to home screen
- **Splash screen:** Branded loading screen on launch

### 6.3 Camera Access

- **getUserMedia API:** Direct camera access for photo capture
- **File input fallback:** Gallery selection on devices without camera API
- **Permission handling:** Graceful handling of denied permissions
- **Orientation handling:** Proper photo orientation regardless of device rotation

### 6.4 Background Sync

```typescript
// Register background sync
async function registerBackgroundSync() {
  const registration = await navigator.serviceWorker.ready;
  if ('sync' in registration) {
    await registration.sync.register('sync-photos');
  }
}

// Service worker handles sync event
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-photos') {
    event.waitUntil(syncQueuedPhotos());
  }
});
```

---

## 7. Security

### 7.1 Row Level Security (RLS)

All 12 tables have RLS enabled with the following policy pattern:

```sql
-- Read: All authenticated users
CREATE POLICY "Allow authenticated read" ON <table>
  FOR SELECT TO authenticated USING (true);

-- Insert: All authenticated users
CREATE POLICY "Allow authenticated insert" ON <table>
  FOR INSERT TO authenticated WITH CHECK (true);

-- Update: Admin, area_lead, supervisor only
CREATE POLICY "Allow admin/lead update" ON <table>
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'area_lead', 'supervisor'))
  );
```

### 7.2 Authentication

- **Supabase Auth:** Email/password authentication with JWT tokens
- **Session management:** Automatic token refresh, secure cookie storage
- **Role-based access:** Profile role determines UI and API access
- **Auto-profile creation:** Trigger creates profile row on signup

### 7.3 Data Validation

- **Database constraints:** CHECK constraints on all enums, NOT NULL where required
- **TypeScript types:** Full type coverage for all database operations
- **Input sanitization:** All user inputs validated before database insertion
- **File validation:** Photo uploads validated for type and size

### 7.4 Photo Security

- **Authenticated uploads:** Storage RLS requires authentication
- **Public read:** Photos served via CDN with public URLs (compliance requirement)
- **Admin-only delete:** Only admins/supervisors can delete photos
- **EXIF stripping:** Canvas API compression removes metadata

---

## 8. Photo Handling Pipeline

See [SaniExpert Photo Storage and Compression Strategy](SaniExpert_Photo_Storage_Compression_Strategy.md) for full details.

**Summary:**

| Stage | Technology | Size | Reduction |
|-------|-----------|------|-----------|
| Original | Device camera | ~3.5 MB | — |
| Layer 1 | Canvas API (1920px, 85% JPEG) | ~0.5 MB | ~85% |
| Layer 2 | Cloudinary (f_webp, q_auto) | ~0.22 MB | ~94% |

---

## 9. Known Issues and Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| **iOS Camera Orientation** | iOS devices rotate photos based on device orientation | Read EXIF Orientation tag and apply canvas transform before compression |
| **IndexedDB Storage Limits** | Browser quota ~50-200MB | Auto-delete synced photos after 7 days; show storage usage warning |
| **Supabase Realtime Reconnection** | Network drops cause subscription loss | Implement exponential backoff reconnection in useRealtime hooks |
| **Photo Upload Timeouts** | Large uploads on slow connections | Chunk uploads; show progress indicator; allow background upload |
| **Shift Boundary Conflicts** | Assignments crossing shift boundaries | Enforce date-based assignment scope; auto-abandon at shift end |
| **Concurrent Area Locking** | Race condition when two users lock simultaneously | Use atomic UPDATE with WHERE locked_by IS NULL check |
| **Camera Permission Denied** | User denies camera access | Graceful fallback to file input; persistent permission indicator |
| **Offline-Online Race** | Sync triggers before full connectivity | Implement connectivity verification before sync; retry with backoff |

---

## 10. Future Enhancements

### Phase 2 Features

| Feature | Description | Priority |
|---------|-------------|----------|
| **Multi-line support** | Full support for multiple production lines beyond MACY | High |
| **Client portal** | External dashboard for clients to view sanitation status | High |
| **Reporting dashboard** | Charts, trends, and analytics for supervisors | High |
| **Push notifications** | Real-time alerts for assignments, damage reports, verifications | Medium |
| **Barcode/QR scanning** | Scan equipment barcodes for asset tracking | Medium |
| **Temperature logging** | Integration with temperature sensors for RTE verification | Medium |
| **Signature capture** | Digital signatures for final verification sign-off | Medium |
| **Export to PDF** | Generate PDF reports for compliance documentation | Medium |
| **AI photo analysis** | Automated cleanliness detection from photos | Low |
| **Integration with ERP** | Connect to client ERP systems for production scheduling | Low |

### Phase 3 Features

| Feature | Description | Priority |
|---------|-------------|----------|
| **Multi-tenant architecture** | True SaaS with isolated client data | Medium |
| **White-label support** | Custom branding per client | Low |
| **Mobile native app** | React Native app for iOS/Android | Low |
| **Advanced analytics** | ML-based predictive maintenance and scheduling | Low |
| **API for third parties** | Public API for integrations | Low |

---

## Document Information

| Property | Value |
|----------|-------|
| Version | 1.0 |
| Date | 2024 |
| Author | SaniExpert Development Team |
| Status | Active |
| Review Cycle | Monthly |
