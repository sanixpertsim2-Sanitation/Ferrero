# SaniExpert Photo Storage and Compression Strategy

Comprehensive documentation of the photo handling pipeline for the SaniExpert sanitation management application, covering client-side compression, server-side optimization, storage architecture, and offline handling.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Two-Layer Compression Pipeline](#two-layer-compression-pipeline)
3. [Storage Architecture](#storage-architecture)
4. [Size Estimates and Projections](#size-estimates-and-projections)
5. [Free Tier Limits](#free-tier-limits)
6. [Offline Handling](#offline-handling)
7. [Auto-Delete Policy](#auto-delete-policy)
8. [Implementation Details](#implementation-details)
9. [Security Considerations](#security-considerations)

---

## Architecture Overview

The SaniExpert photo pipeline handles photos captured during sanitation checks, damage reports, and area lead verifications. The system uses a **two-layer compression approach** to minimize storage and bandwidth usage while maintaining visual quality sufficient for compliance documentation.

```
Device Camera
      |
      v
+------------------+     +-------------------+     +-------------------+
| Layer 1: Client  | --> | Layer 2: Cloudinary | --> | Supabase Storage  |
| Canvas API       |     | Auto WebP + Quality  |     | (verification-    |
| 1920px, 85% JPEG |     | Auto Quality         |     |  photos bucket)   |
+------------------+     +-------------------+     +-------------------+
   ~3.5MB original         ~0.5MB compressed         ~0.22MB final
        |                        |                         |
        v                        v                         v
   Raw camera file        Upload to Cloudinary        Metadata stored
   (discarded)            (auto-optimized)            in Supabase
                                                        (public URL)
```

---

## Two-Layer Compression Pipeline

### Layer 1: Client-Side Canvas API Compression

**Purpose:** Reduce file size before upload to minimize bandwidth usage and upload time.

**Implementation:**

```typescript
function compressPhoto(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Resize to max 1920px on longest side
      const maxSize = 1920;
      let { width, height } = img;
      if (width > height && width > maxSize) {
        height = (height * maxSize) / width;
        width = maxSize;
      } else if (height > maxSize) {
        width = (width * maxSize) / height;
        height = maxSize;
      }

      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);

      // Compress to JPEG at 85% quality
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas compression failed'));
        },
        'image/jpeg',
        0.85
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
```

**Parameters:**

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Max dimension | 1920px | Sufficient detail for documentation; 2K display compatible |
| Output format | JPEG | Universal browser support; efficient compression |
| Quality | 85% | Sweet spot between file size and visual quality |
| Aspect ratio | Preserved | Maintains original framing and proportions |

**Results:**

| Metric | Value |
|--------|-------|
| Original file (modern phone) | ~3.5 MB |
| After Layer 1 compression | ~0.5 MB |
| Reduction | ~85-90% |

### Layer 2: Server-Side Cloudinary Optimization

**Purpose:** Convert to modern WebP format with automatic quality optimization for delivery.

**Implementation:**

Cloudinary's fetch/upload API automatically applies:

```
https://res.cloudinary.com/<cloud_name>/image/upload/
  q_auto,f_webp/
  <public_id>
```

**Parameters:**

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `f_webp` | WebP format | 25-35% smaller than JPEG at equivalent quality |
| `q_auto` | Auto quality | Cloudinary selects optimal quality per image content |
| `w_auto` | Auto width | Responsive sizing based on device viewport |

**Results:**

| Metric | Value |
|--------|-------|
| After Layer 1 (input to Cloudinary) | ~0.5 MB |
| After Layer 2 (WebP + auto quality) | ~0.22 MB |
| Total reduction | ~94% |

### Combined Pipeline Results

| Stage | File Size | Reduction |
|-------|-----------|-----------|
| Original camera photo | ~3.5 MB | — |
| After Layer 1 (Canvas) | ~0.5 MB | ~85% |
| After Layer 2 (Cloudinary) | ~0.22 MB | ~94% |

---

## Storage Architecture

### Dual Storage Strategy

Photos are stored using two complementary services:

| Service | Purpose | What Gets Stored |
|---------|---------|-----------------|
| **Cloudinary** | Image hosting + CDN + optimization | Actual image files (compressed JPEG, served as WebP) |
| **Supabase Storage** | Metadata + backup | Photo metadata, backup copies, verification records |

### Cloudinary Storage

- **Primary delivery:** All photos are served via Cloudinary's global CDN
- **URL format:** `https://res.cloudinary.com/<cloud>/image/upload/<id>`
- **Optimization:** Automatic WebP conversion and quality optimization on delivery
- **Transformations:** On-the-fly resizing for thumbnails, previews, and full-size views

### Supabase Storage Bucket

Bucket configuration (`database/setup_storage_rls.sql`):

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-photos', 'verification-photos', true);
```

| Property | Value | Reason |
|----------|-------|--------|
| Bucket ID | `verification-photos` | Matches RLS policies in schema |
| Public access | `true` | Photos must be viewable in the app without signed URLs |
| RLS enabled | Yes | Authenticated users only (read/write) |
| Admin delete | Yes | Only admins/supervisors can delete |

### Data Flow

```
User takes photo
      |
      v
[Client] Canvas API compression (3.5MB -> 0.5MB)
      |
      +--> [IndexedDB] Save for offline sync
      |
      v
[Cloudinary] Upload compressed JPEG
      |
      v
Cloudinary returns public URL
      |
      v
[Supabase] Store URL in checklist_responses.photo_url
           or damage_reports.photo_url
           or findings.photo_url
      |
      v
[Supabase Storage] Upload backup copy to verification-photos bucket
      |
      v
App displays image via Cloudinary CDN URL with f_webp,q_auto
```

---

## Size Estimates and Projections

### Per-Photo Storage

| Component | Size | Storage Location |
|-----------|------|-----------------|
| Original camera photo | 3.5 MB | Discarded after compression |
| Layer 1 compressed JPEG | 0.5 MB | Uploaded to Cloudinary |
| Layer 2 optimized WebP | 0.22 MB | Served to users |
| Supabase backup copy | 0.5 MB | verification-photos bucket |
| Database metadata row | ~0.5 KB | Supabase PostgreSQL |

### Daily Volume Estimate (MACY Line)

| Activity | Photos/Day | Size/Day | Size/Month |
|----------|-----------|----------|------------|
| Checklist responses | ~25 | ~12.5 MB | ~375 MB |
| Damage reports | ~5 | ~2.5 MB | ~75 MB |
| Area lead verifications | ~5 | ~2.5 MB | ~75 MB |
| **Total** | **~35** | **~17.5 MB** | **~525 MB** |

### Annual Projection

| Metric | Value |
|--------|-------|
| Photos per year | ~12,775 |
| Cloudinary storage (0.5MB each) | ~6.4 GB |
| Supabase Storage (0.5MB backup) | ~6.4 GB |
| Database rows | ~12,775 |
| Database metadata size | ~6.4 MB |

### Multi-Line Scaling

| Production Lines | Annual Photos | Cloudinary Storage | Supabase Storage |
|-----------------|---------------|-------------------|------------------|
| 1 (MACY) | ~12,775 | ~6.4 GB | ~6.4 GB |
| 2 | ~25,550 | ~12.8 GB | ~12.8 GB |
| 3 | ~38,325 | ~19.2 GB | ~19.2 GB |
| 5 | ~63,875 | ~32 GB | ~32 GB |

---

## Free Tier Limits

### Cloudinary Free Tier

| Limit | Value | MACY Line Coverage |
|-------|-------|-------------------|
| Storage | 25 GB | ~9.7 years |
| Bandwidth | 25 GB/month | ~50,000 photo views/month |
| Transformations | 25,000/month | Sufficient |
| Requests | N/A | No hard limit on free tier |

**Verdict:** Cloudinary free tier is more than sufficient for MACY line operations.

### Supabase Free Tier

| Limit | Value | Usage |
|-------|-------|-------|
| Database | 500 MB | Metadata only (~6.4 MB/year) — very comfortable |
| Storage | 1 GB | Backup photos (6.4 GB/year) — exceeds after ~2 months |
| Bandwidth | 2 GB/month | Downloading backup copies |
| Realtime | 200 concurrent | Sufficient for team size |
| Auth | 50,000 users/month | Far exceeds needs |

**Verdict:** Database is fine on free tier. Storage for photo backups will need paid tier ($0.021/GB/month) or use Cloudinary as the sole image host with Supabase storing only URLs.

### Recommended Strategy

| Service | Tier | Cost (1 line) | Notes |
|---------|------|---------------|-------|
| Cloudinary | Free | $0 | Sufficient for 9+ years |
| Supabase | Free | $0 | DB + Auth + Realtime |
| Supabase Storage | Free (1 GB) | $0 | For metadata; may need upgrade for backups |

---

## Offline Handling

### Problem

Sanitation workers may lose network connectivity while working in production areas (basement locations, Faraday cage effects from equipment, WiFi dead zones).

### Solution: IndexedDB Queue with Background Sync

**Architecture:**

```
User takes photo while offline
      |
      v
[IndexedDB] Store photo Blob + metadata
      |
      v
User continues checklist (all offline)
      |
      v
Connectivity restored
      |
      v
[Background Sync] Queue processes:
  1. Upload photos to Cloudinary
  2. Upload backup to Supabase Storage
  3. Insert records to Supabase DB
  4. Mark as synced in IndexedDB
      |
      v
Auto-delete local copies (after 7 days)
```

**Implementation:**

```typescript
// IndexedDB schema (using Dexie)
interface QueuedPhoto {
  id?: number;              // Auto-increment
  assignmentId: string;     // Which assignment this photo belongs to
  checklistItemId: string;  // Which checklist item
  photoBlob: Blob;          // The actual photo data
  response?: 'YES' | 'NO' | 'N/A';
  notes?: string;
  countValue?: number;
  createdAt: Date;
  syncedAt?: Date;          // Null until synced
}

interface QueuedDamageReport {
  id?: number;
  lineId: string;
  areaId: string;
  description: string;
  photoBlob: Blob;
  severity: 'low' | 'medium' | 'high';
  createdAt: Date;
  syncedAt?: Date;
}
```

**Sync Process:**

```typescript
async function syncQueuedPhotos(): Promise<void> {
  const unsynced = await db.queuedPhotos
    .where('syncedAt')
    .isNull()
    .toArray();

  for (const item of unsynced) {
    try {
      // 1. Compress if not already
      const compressed = await compressPhoto(
        new File([item.photoBlob], 'photo.jpg')
      );

      // 2. Upload to Cloudinary
      const cloudinaryUrl = await uploadToCloudinary(compressed);

      // 3. Upload backup to Supabase Storage
      await uploadToSupabaseStorage(compressed, `${item.assignmentId}/${Date.now()}.jpg`);

      // 4. Insert checklist response to Supabase
      await supabase.from('checklist_responses').insert({
        assignment_id: item.assignmentId,
        checklist_item_id: item.checklistItemId,
        response: item.response,
        photo_url: cloudinaryUrl,
        count_value: item.countValue,
        notes: item.notes,
      });

      // 5. Mark as synced
      await db.queuedPhotos.update(item.id!, { syncedAt: new Date() });
    } catch (error) {
      console.error('Sync failed for photo:', item.id, error);
      // Leave unsynced — will retry on next sync
    }
  }
}
```

**Sync Triggers:**

| Event | Action |
|-------|--------|
| App comes online (navigator.onLine) | Trigger sync |
| User submits checklist | Attempt immediate sync; queue if offline |
| User opens dashboard | Check for unsynced items; trigger sync |
| Periodic (every 5 min when online) | Background sync attempt |

**UI Indicators:**

| State | UI Element | Color |
|-------|-----------|-------|
| Saved locally only | Cloud icon with slash | Yellow/Orange |
| Syncing | Spinner with cloud icon | Blue |
| Synced | Checkmark with cloud icon | Green |
| Sync failed | Exclamation with cloud icon | Red |

---

## Auto-Delete Policy

### Rationale

IndexedDB storage is limited (typically 50-200 MB in mobile browsers). To prevent storage exhaustion, successfully synced photos are automatically purged from local storage.

### Policy

```typescript
const DELETE_AFTER_DAYS = 7;  // Keep synced photos for 7 days

async function cleanupSyncedPhotos(): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - DELETE_AFTER_DAYS);

  // Delete synced checklist photos older than 7 days
  const oldPhotos = await db.queuedPhotos
    .where('syncedAt')
    .below(cutoffDate)
    .toArray();

  for (const photo of oldPhotos) {
    await db.queuedPhotos.delete(photo.id!);
  }

  // Same for damage reports
  const oldReports = await db.queuedDamageReports
    .where('syncedAt')
    .below(cutoffDate)
    .toArray();

  for (const report of oldReports) {
    await db.queuedDamageReports.delete(report.id!);
  }
}
```

### Retention Schedule

| Stage | Retention | Action |
|-------|----------|--------|
| Unsynced photos | Until synced | Keep indefinitely |
| Recently synced (< 7 days) | 7 days | Available for review/retry |
| Old synced photos (> 7 days) | Permanent (Cloudinary) | Deleted from IndexedDB |

### Manual Controls

- **Force sync button:** Available in settings for immediate sync
- **Clear local data:** Emergency option to wipe all local storage (with confirmation)
- **Storage usage indicator:** Shows current IndexedDB usage in settings

---

## Implementation Details

### TypeScript Types

```typescript
// Photo compression result
interface CompressedPhoto {
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
  mimeType: string;
}

// Photo upload result
interface PhotoUploadResult {
  cloudinaryUrl: string;
  supabasePath: string;
  publicUrl: string;
  size: number;
}

// Sync status
enum SyncStatus {
  PENDING = 'pending',
  SYNCING = 'syncing',
  SYNCED = 'synced',
  FAILED = 'failed',
}
```

### Hook: usePhotoCompression

```typescript
function usePhotoCompression() {
  const [compressing, setCompressing] = useState(false);
  const [progress, setProgress] = useState(0);

  const compress = useCallback(async (file: File): Promise<CompressedPhoto> => {
    setCompressing(true);
    setProgress(0);
    try {
      const result = await compressPhoto(file, {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.85,
        onProgress: setProgress,
      });
      return result;
    } finally {
      setCompressing(false);
    }
  }, []);

  return { compress, compressing, progress };
}
```

### Hook: usePhotoUpload

```typescript
function usePhotoUpload() {
  const [uploading, setUploading] = useState(false);

  const upload = useCallback(async (
    blob: Blob,
    folder: string
  ): Promise<PhotoUploadResult> => {
    setUploading(true);
    try {
      // Upload to Cloudinary
      const formData = new FormData();
      formData.append('file', blob);
      formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
      formData.append('folder', `sanexpert/${folder}`);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formData }
      );

      const data = await response.json();

      return {
        cloudinaryUrl: data.secure_url,
        supabasePath: `${folder}/${data.public_id}`,
        publicUrl: data.secure_url,
        size: blob.size,
      };
    } finally {
      setUploading(false);
    }
  }, []);

  return { upload, uploading };
}
```

---

## Security Considerations

1. **Authenticated uploads only** — RLS policies ensure only logged-in users can upload
2. **No public write access** — Storage bucket is public for read only; writes require auth
3. **HTTPS everywhere** — All uploads and downloads use encrypted connections
4. **URL expiration** — Cloudinary URLs can be configured with signed URLs for sensitive photos
5. **No EXIF data leakage** — Canvas API compression strips EXIF metadata (GPS, device info)
6. **Backup retention** — Supabase Storage backups follow the same RLS policies as primary storage

---

## Summary

| Aspect | Strategy |
|--------|----------|
| Compression | Two-layer: Canvas API (client) + Cloudinary (server) |
| Size reduction | 94% (3.5 MB -> 0.22 MB) |
| Primary storage | Cloudinary CDN (free tier: 9+ years) |
| Backup storage | Supabase Storage bucket |
| Offline handling | IndexedDB queue with background sync |
| Sync trigger | Online event + periodic + manual |
| Local retention | 7 days after sync |
| Format | JPEG upload, WebP delivery |
| Quality | 85% JPEG, Cloudinary auto-quality |
| Max dimension | 1920px longest side |

This strategy ensures efficient photo handling with minimal costs, robust offline support, and compliance-grade photo documentation.
