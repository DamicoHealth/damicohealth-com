# DH Field EMR — Complete Reference & Troubleshooting Guide

## How to use this document

This is a complete technical reference for **DH Field EMR**, written so an **AI assistant can read it and help you**. If you are setting it up, hit an error, or want to customize it and you're not sure what to do:

1. Open **claude.ai** (or any capable AI assistant).
2. Start a new chat and **upload this PDF** (or paste its text).
3. Describe what you're trying to do, or the **exact** message/behavior you see.

The AI can then use everything below to walk you through installation, fix Supabase and sync problems, and help you customize the forms. To get the best help, tell it: **your device** (iPad / iPhone / Android / laptop), **which mode** you chose (Standalone or Cloud), and the **exact text** of any error on screen.

---

## 1. What DH Field EMR is

DH Field EMR is a **free electronic medical record** built for international medical-outreach and global-health teams. It is **not** for the US healthcare system and is **not** HIPAA-certified.

**Key architecture facts (important for troubleshooting):**

- It is a **PWA (Progressive Web App)** — a web app that runs in the browser and can be "installed" to the home screen. There is **no app store**.
- All patient data is stored **on the device** in the browser's local database (IndexedDB), so it **works fully offline**.
- Optionally, devices **sync** to a **Supabase** cloud database that **you create and own**. We (Damico Health) never host or see your data.
- When online, records sync automatically; when offline, they save locally and sync later.
- The app shows its **build version** next to the title (e.g. `v2026-05-30 17:22`). This is how you confirm a device is on the latest code.

**The three data locations:**

| Location | What it is | Survives |
|---|---|---|
| Device (browser storage) | Where records live day-to-day | App restarts; can rarely be cleared by the OS (esp. iOS) |
| Your Supabase project | Your cloud copy; shared across devices | Until you delete it; the real off-device safety net |
| Backup file (.json) | A file you download from the app | Forever — a normal file you control |

---

## 2. Installing the app

Open the app in a browser first (the launch link is on **damicohealth.com**), then add it to the home screen so it works offline.

**iPad / iPhone (must use Safari):**
1. Open the link in **Safari** (Chrome on iOS cannot install PWAs).
2. Tap the **Share** button (square with an up-arrow).
3. Tap **Add to Home Screen**, then **Add**.
4. Always open the app from the **new home-screen icon** afterward — this is what makes offline storage reliable.

**Android (Chrome):**
1. Open the link in **Chrome**.
2. Tap the **⋮** menu → **Install app** (or tap the "Install" banner).
3. Open it from the app drawer.

**Laptop / Desktop (Chrome or Edge):**
1. Open the link in Chrome or Edge.
2. Click the **Install** icon in the address bar (a small monitor with a down-arrow), or menu → **Install**.

**Getting updates / making sure you're on the latest version:**
- When a new version ships, a small **"Update now"** bar appears at the bottom — tap it.
- Check the **version label** next to the app title. If it's old, fully close and reopen the app, or tap "Update now."
- To force a clean update on iPad: delete the home-screen icon, reopen the link in Safari, and Add to Home Screen again. (This clears local test data — fine for a fresh start, but back up first if you have real data only on that device.)

---

## 3. Choosing a mode (first launch)

On first launch a short wizard offers three options:

- **Standalone (Offline Only)** — all data stays on this one device; no cloud; no setup. Best for trying it out or a single device.
- **New Organization** — the **first** device for a team; you create your own Supabase and become the admin.
- **Join Existing Setup** — an **additional** device joining a team; you paste the same Supabase URL + key the team already uses.

You can switch from Standalone to Cloud later in **Admin → Cloud Connection**.

---

## 4. Setting up your own Supabase (cloud sync)

You do this **once** for the whole team. It gives your records a cloud home you own.

1. Create a free account at **supabase.com**.
2. Click **New project**. Name it, set a database password (save it), pick a region near where you work, create it, and wait ~1 minute.
3. In the left sidebar, open **SQL Editor → New query**.
4. Paste the **setup SQL** (Section 4a) and click **Run**. You should see "Success."
5. Open **Settings → API**. Copy your **Project URL** (`https://xxxx.supabase.co`) and your **anon** / **publishable** key (a long string starting with `eyJ…`). **Never** use the `service_role` / secret key.
6. In the app's wizard ("New Organization"), paste the **URL** and **anon key**, let it seed the default presets, name the device, and set an **admin password**.

### 4a. The setup SQL (run once)

```
CREATE TABLE IF NOT EXISTS records (
  id UUID PRIMARY KEY,
  device_id TEXT, site TEXT, date TEXT, mrn TEXT,
  given_name TEXT, family_name TEXT, name TEXT, sex TEXT, dob TEXT, phone TEXT,
  pregnant TEXT, breastfeeding TEXT, temp TEXT, bp TEXT, weight TEXT,
  allergies TEXT, current_meds TEXT, pmh TEXT, chief_concern TEXT,
  labs JSONB DEFAULT '{}'::jsonb, lab_comments TEXT,
  urinalysis JSONB DEFAULT '{}'::jsonb, blood_glucose TEXT,
  diagnosis TEXT, diagnosis_codes JSONB DEFAULT '[]'::jsonb,
  medications JSONB DEFAULT '[]'::jsonb, treatment_notes TEXT, treatment TEXT,
  procedures JSONB DEFAULT '[]'::jsonb, transport TEXT, travel_time TEXT,
  access_to_care JSONB, referral_type TEXT, referral_date TEXT, referral_status TEXT,
  imaging JSONB, surgery JSONB, provider TEXT, notes TEXT,
  custom_fields JSONB DEFAULT '{}'::jsonb, template_id TEXT, template_name TEXT,
  age_estimated BOOLEAN DEFAULT false, saved_at TIMESTAMPTZ,
  sync_version INTEGER DEFAULT 1, deleted BOOLEAN DEFAULT false,
  synced_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT DEFAULT 'standard',
  org_name TEXT, last_sync_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY, value JSONB, updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE records ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE config  ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_records"   ON records FOR SELECT USING (true);
CREATE POLICY "anon_insert_records" ON records FOR INSERT WITH CHECK (
  device_id IS NOT NULL AND EXISTS (SELECT 1 FROM devices WHERE id = device_id));
CREATE POLICY "anon_update_records" ON records FOR UPDATE USING (
  device_id IS NOT NULL AND EXISTS (SELECT 1 FROM devices WHERE id = device_id));
CREATE POLICY "anon_read_devices"   ON devices FOR SELECT USING (true);
CREATE POLICY "anon_insert_devices" ON devices FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_devices" ON devices FOR UPDATE USING (true);
CREATE POLICY "anon_read_config"   ON config FOR SELECT USING (true);
CREATE POLICY "anon_write_config"  ON config FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_config" ON config FOR UPDATE USING (true);
```

This is safe to re-run (every statement uses `IF NOT EXISTS` or `CREATE POLICY`). If a policy already exists and a re-run errors on it, that policy is simply already there — ignore that specific error.

---

## 5. Adding more devices

For every other phone/tablet/laptop:
1. Install the app and open it.
2. In the wizard choose **Join Existing Setup**.
3. Paste the **same Supabase URL and anon key** the first device used.
4. Name the device — it pulls down your presets and history.

Keep the URL + key somewhere your team can find them. They are the "key" to your shared data; don't post them publicly.

---

## 6. Using the EMR (feature reference)

- **Records screen** — the home base. Search, filter, open patients, start new encounters.
- **New Encounter** — tap **+ New Encounter**. Enter name + date of birth → the **MRN auto-generates**. If the patient was seen before, a **Return Patient** indicator carries forward their history, allergies, and meds.
- **Vitals** — temperature, BP, weight, etc. Out-of-range values highlight.
- **Labs** — one-tap **POS/NEG** buttons, numeric entry, and a urinalysis dipstick panel. Admins can add custom tests.
- **Diagnosis** — pick from presets or type a free-text working diagnosis.
- **Medications** — **Rx presets** (one-tap bundles like "Malaria — adult") or the **medication builder** (drug, dose with weight-based math, route, frequency, duration).
- **Procedures / Imaging / Surgery** — optional blocks for OR cases, ultrasounds, etc.
- **Referrals** — record onward referrals with a scheduled date; they show in **Scheduling**.
- **Save & Next** — saves and immediately opens a fresh form (and returns to the top) for fast batch entry. **Save & Close** returns to the records list.
- **Search & filters** — by name, MRN, diagnosis, medication, site; stackable filters by date/provider/site.
- **Patient history** — tap a patient to see all visits in order; start a new visit linked to the same MRN.
- **Analytics** — live dashboards (patient volume, disease burden, lab positivity, provider productivity) and a **one-tap donor report**; **CSV export** for any spreadsheet.

---

## 7. Customizing the app (admin)

In **Options** / **Admin** (admin device, behind the admin password):

- **Form builder** — add your own **sections** and **questions**. Field types: text, single-select, multi-select, number, numeric range, yes/no, date. Changes sync to all devices.
- **Multiple encounter forms** — create more than one form (e.g. general vs. surgical vs. dental). A picker appears at "New Encounter" only when more than one exists.
- **Presets** — edit sites, providers, medications (formulary), diagnoses, procedures, lab tests, Rx bundles, referral types, chief complaints. Most have a show/hide toggle (hide instead of delete to keep old records' labels intact).

---

## 8. Sync & offline behavior (read this for "lost data" worries)

- **Online:** records sync to your Supabase automatically (on save, on reconnect, on app foreground, and on a light interval). The cloud copy is your real safety net.
- **Offline:** records save to the device and sync once you're back online. Conflicts use last-write-wins, with the server's timestamp as the authority.
- **A subtle but important point about offline + force-quit:** when you tap Save, the device may take a few seconds to fully write the record to permanent storage. If you **force-quit the app within a second or two of saving**, that very last record can be lost before it's flushed to disk. In normal use (charting through a clinic day, not force-quitting between patients) this does not happen — which is why heavy field use works fine. **Best practice:** give a save a few seconds before force-closing, and sync or back up regularly.
- **iOS reality:** Apple can occasionally clear a web app's local storage. Installed (home-screen) apps are far safer than a Safari tab, but **the guaranteed protection is cloud sync (when online) and a daily downloaded backup.** Android does not have this aggressive behavior.

---

## 9. Backups

In **Admin → Backup**:
- **Download Backup** → saves a `.json` file (to Files, AirDrop, or a laptop) containing all encounters, presets, and configuration. A downloaded file can never be cleared by the device.
- **Restore from File** → merges a backup back in (never wipes existing data).

Do this at the end of each clinic day if you are not syncing.

---

## 10. Troubleshooting — the EMR app

| Symptom | Likely cause | Fix |
|---|---|---|
| My fix/feature isn't showing up | Old cached version | Check the version label by the title; tap "Update now"; on iPad, delete + re-add to Home Screen |
| Records gone after force-quitting offline | Force-quit within ~1–2 s of saving (not flushed), or iOS cleared storage | Give saves a few seconds; sync when online; download daily backups |
| Male/Female (toggle) looks half-selected | Old cached version (fixed in current builds) | Update to the latest version |
| "Save & Next" doesn't jump to top | Old cached version | Update to the latest version |
| A section is collapsed unexpectedly | Older default | Update; sections are expanded by default in current builds |
| Records not appearing on another device | Not synced yet, or other device on a different Supabase | Tap Sync on both; confirm both use the **same** URL + key |
| App won't load offline | Service worker didn't finish caching on first install | Open it once **online** so it can cache, then it works offline |
| Setup wizard reappears / device "forgot" setup | Local storage was cleared (esp. iOS) | Re-enter the same Supabase URL + key via **Join Existing Setup** to pull data back; use a backup if standalone |

---

## 11. Troubleshooting — Supabase & sync

| Symptom / error | Likely cause | Fix |
|---|---|---|
| Sync says "error" or won't connect | Wrong URL or key, or no internet | Re-check **Settings → API**: URL like `https://xxxx.supabase.co`; key is the long `eyJ…` **anon/publishable** key (not service_role) |
| "JWT" / "invalid API key" / 401 | Wrong or truncated key | Re-copy the **entire** anon key (200+ chars); paste again with no spaces |
| Records save locally but never reach the cloud | Device not registered, or RLS blocking inserts | Make sure setup SQL ran (the `devices` table + policies must exist); the device registers itself on first cloud connect |
| "permission denied for table records" / "row-level security" | The RLS policies weren't created, or the device row is missing | Re-run the **setup SQL** (Section 4a); confirm the device appears in the `devices` table |
| "relation 'records' does not exist" / column errors | The setup SQL never ran, or an older partial schema | Run the full **setup SQL** in the SQL Editor; it's safe to re-run |
| Other devices don't see new records | They're on a different project, or haven't synced | Confirm identical URL + key on every device; tap Sync; check the `records` table in Supabase has the rows |
| Free Supabase project "paused" | Free projects pause after ~1 week of no activity | Open the Supabase dashboard and **Resume** the project; then sync |
| Worried data is exposed | The anon key allows read/write per the policies | Keep the URL + key private (treat like a password); for stricter control, restrict policies to admin devices |

**How to verify data is actually in the cloud:** in Supabase, open **Table Editor → records**. If your rows are there, your data is safe regardless of any single device.

---

## 12. FAQ

- **Is it really free?** Yes — no subscriptions or fees. Optional donations only.
- **Do you see our patient data?** No. It lives on your devices and in **your** Supabase project, which we don't host or access.
- **Can it work with no internet for days?** Yes for charting; the data stays on the device. For guaranteed safety, sync whenever you get a connection and keep daily backups.
- **iPad vs Android?** Both work. Android storage is more forgiving offline; on iPad, install to the Home Screen and rely on sync/backups.
- **How many devices/patients?** No hard limits in the app; practical limits come from your (free) Supabase tier, which is generous for field clinics.

---

## 13. Glossary

- **PWA** — a web app you install to the home screen; runs offline.
- **MRN** — Medical Record Number; auto-generated from name + date of birth.
- **Supabase** — the free cloud database service you create to sync/back up data.
- **anon / publishable key** — the public API key the app uses; safe for client apps. (Never use the secret/service_role key.)
- **RLS (Row Level Security)** — database rules controlling who can read/write; set up by the setup SQL.
- **Standalone vs Cloud** — offline-only on one device vs synced to your Supabase across devices.

---

*DH Field EMR is a documentation tool, not a medical device, and is not a substitute for clinical judgment. It is for international outreach use, is not HIPAA-compliant, and is provided free and "as is." Full terms and privacy at damicohealth.com.*
