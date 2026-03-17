const USER_KEY = 'timetrack_user';
const USERS_KEY = 'timetrack_users';
const BACKEND_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL || 'http://localhost:8765').replace(/\/$/, '');
const CLOUDINARY_CLOUD_NAME = typeof import.meta !== 'undefined' ? String(import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME || '').trim() : '';
const CLOUDINARY_UPLOAD_PRESET = typeof import.meta !== 'undefined' ? String(import.meta.env?.VITE_CLOUDINARY_UPLOAD_PRESET || '').trim() : '';
const CLOUDINARY_FOLDER = typeof import.meta !== 'undefined' ? String(import.meta.env?.VITE_CLOUDINARY_FOLDER || 'timesheet-images').trim() : 'timesheet-images';
const ENTRIES_KEY = 'timetrack_entries';
const SESSION_KEY = 'timetrack_session';
const LOCATION_TAGS_KEY = 'timetrack_location_tags';

const DEFAULT_LOCATION_TAGS = [
  { code: 'CLB', county_name: 'Franklin', data_center_location: 'Columbus', is_active: true },
  { code: 'LCT', county_name: 'Fairfield', data_center_location: 'Lancaster', is_active: true },
  { code: 'NBY', county_name: 'Licking', data_center_location: 'Newark', is_active: true },
];

function uid(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeLocationTagRecord(raw = {}) {
  return {
    code: String(raw.code || '').trim().toUpperCase(),
    county_name: String(raw.county_name || '').trim(),
    data_center_location: String(raw.data_center_location || '').trim(),
    is_active: raw.is_active !== false,
    created_date: raw.created_date || new Date().toISOString(),
    updated_date: raw.updated_date || new Date().toISOString(),
  };
}

function ensureLocationTags() {
  const existing = readJson(LOCATION_TAGS_KEY, null);
  if (Array.isArray(existing) && existing.length > 0) {
    return existing.map(normalizeLocationTagRecord);
  }
  const seeded = DEFAULT_LOCATION_TAGS.map(normalizeLocationTagRecord);
  writeJson(LOCATION_TAGS_KEY, seeded);
  return seeded;
}

function authRequiredError() {
  const err = new Error('Authentication required');
  err.type = 'auth_required';
  return err;
}

function titleCaseName(text = '') {
  return String(text)
    .trim()
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function derivePreferredName(user) {
  if (!user || typeof user !== 'object') return 'Local User';

  const explicit = [
    user.display_name,
    user.full_name,
    user.name,
    user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : '',
  ]
    .map((v) => String(v || '').trim())
    .find(Boolean);

  if (explicit) return explicit;

  const emailLocal = String(user.email || '').split('@')[0];
  const username = String(user.username || '').trim();
  const fallback = emailLocal || username;
  return fallback ? titleCaseName(fallback) : 'Local User';
}

function normalizeUser(raw) {
  const user = raw && typeof raw === 'object' ? { ...raw } : {};
  const preferredName = derivePreferredName(user);
  const parsedPayrollStart = Number(user.payroll_second_period_start_day);
  const payrollSecondPeriodStartDay = Number.isFinite(parsedPayrollStart)
    ? Math.min(28, Math.max(2, Math.floor(parsedPayrollStart)))
    : 16;

  return {
    ...user,
    email: String(user.email || '').trim().toLowerCase(),
    full_name: preferredName,
    display_name: preferredName,
    user_role: user.user_role === 'manager' ? 'manager' : 'employee',
    setup_complete: Boolean(user.setup_complete),
    manager_email: String(user.manager_email || '').trim().toLowerCase(),
    company_name: String(user.company_name || '').trim(),
    work_location_tag: String(user.work_location_tag || '').trim().toUpperCase(),
    data_center_location: String(user.data_center_location || '').trim(),
    location_enforcement_enabled: Boolean(user.location_enforcement_enabled ?? false),
    payroll_second_period_start_day: payrollSecondPeriodStartDay,
  };
}

function readUsers() {
  const users = readJson(USERS_KEY, []);
  if (!Array.isArray(users)) return [];

  const normalizedUsers = users.map(normalizeUser);
  const changed = JSON.stringify(users) !== JSON.stringify(normalizedUsers);
  if (changed) writeJson(USERS_KEY, normalizedUsers);
  return normalizedUsers;
}

function getActiveSession() {
  const session = readJson(SESSION_KEY, null);
  if (!session || !session.email || !session.logged_in) return null;
  return session;
}

function setActiveSession(email) {
  writeJson(SESSION_KEY, {
    email,
    logged_in: true,
    login_at: new Date().toISOString(),
  });
}

function clearActiveSession() {
  localStorage.removeItem(SESSION_KEY);
}

function ensureCurrentUser(requireSession = true) {
  const session = getActiveSession();
  if (requireSession && !session) {
    throw authRequiredError();
  }

  const stored = normalizeUser(readJson(USER_KEY, null));
  if (stored && stored.email && (!session || stored.email === session.email)) {
    writeJson(USER_KEY, stored);
    return stored;
  }

  const users = readUsers();
  if (session) {
    const existing = users.find((u) => String(u.email || '').toLowerCase() === String(session.email).toLowerCase());
    if (existing) {
      const normalizedExisting = normalizeUser(existing);
      writeJson(USER_KEY, normalizedExisting);
      return normalizedExisting;
    }
  }

  const user = {
    id: uid('user'),
    email: session?.email || 'employee@local.dev',
    full_name: 'Local User',
    user_role: 'employee',
    setup_complete: false,
    manager_email: '',
  };
  const normalizedUser = normalizeUser(user);
  writeJson(USER_KEY, normalizedUser);

  const existingIdx = users.findIndex((u) => u.email === normalizedUser.email);
  if (existingIdx >= 0) {
    users[existingIdx] = normalizeUser({ ...users[existingIdx], ...normalizedUser });
  } else {
    users.push(normalizedUser);
  }
  writeJson(USERS_KEY, users);
  return normalizedUser;
}

function currentUser() {
  return ensureCurrentUser();
}

function setCurrentUser(user) {
  const normalized = normalizeUser(user);
  writeJson(USER_KEY, normalized);
  const users = readUsers();
  const idx = users.findIndex((u) => u.id === normalized.id || u.email === normalized.email);
  if (idx >= 0) users[idx] = normalizeUser({ ...users[idx], ...normalized });
  else users.push(normalized);
  writeJson(USERS_KEY, users);
}

function updateRecord(collectionKey, id, patch) {
  const rows = readJson(collectionKey, []);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) throw new Error('Record not found');
  rows[idx] = { ...rows[idx], ...patch, updated_date: new Date().toISOString() };
  writeJson(collectionKey, rows);
  return rows[idx];
}

function applyFilter(rows, filterObj = {}) {
  return rows.filter((row) =>
    Object.entries(filterObj).every(([k, v]) => {
      if (v === undefined || v === null || v === '') return true;
      return row[k] === v;
    })
  );
}

function applySort(rows, sortExpr) {
  if (!sortExpr) return rows;
  const desc = sortExpr.startsWith('-');
  const field = desc ? sortExpr.slice(1) : sortExpr;
  return [...rows].sort((a, b) => {
    const av = a[field] ?? '';
    const bv = b[field] ?? '';
    if (av < bv) return desc ? 1 : -1;
    if (av > bv) return desc ? -1 : 1;
    return 0;
  });
}

function normalizeIsoMinute(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const day = String(parsed.getUTCDate()).padStart(2, '0');
  const hour = String(parsed.getUTCHours()).padStart(2, '0');
  const minute = String(parsed.getUTCMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function entryMergeKey(entry) {
  const email = String(entry?.employee_email || '').trim().toLowerCase();
  const status = String(entry?.status || '').trim().toLowerCase();
  const inPhoto = String(entry?.clock_in_photo_url || '').trim();
  const outPhoto = String(entry?.clock_out_photo_url || '').trim();
  if (inPhoto || outPhoto) {
    return `${email}|photo|${inPhoto}|${outPhoto}|${status}`;
  }

  const date = String(entry?.date || '').slice(0, 10);
  const timeIn = normalizeIsoMinute(entry?.time_in);
  const timeOut = normalizeIsoMinute(entry?.time_out);
  return `${email}|time|${date}|${timeIn}|${timeOut}|${status}`;
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });
}

async function uploadFileToCloudinary(file) {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    return null;
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  if (CLOUDINARY_FOLDER) formData.append('folder', CLOUDINARY_FOLDER);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(body || `Cloudinary upload failed with status ${response.status}`);
  }

  const json = await response.json();
  return String(json?.secure_url || json?.url || '').trim() || null;
}

export const localClient = {
  auth: {
    async me() {
      const user = ensureCurrentUser(true);
      setCurrentUser(user);
      return user;
    },
    async login({ email, fullName } = {}) {
      const normalizedEmail = String(email || '').trim().toLowerCase();
      if (!normalizedEmail) throw new Error('Email is required');

      const users = readUsers();
      const existingIdx = users.findIndex(
        (u) => String(u.email || '').toLowerCase() === normalizedEmail
      );

      let user;
      if (existingIdx >= 0) {
        user = normalizeUser(users[existingIdx]);
      } else {
        user = normalizeUser({
          id: uid('user'),
          email: normalizedEmail,
          full_name: fullName || titleCaseName(normalizedEmail.split('@')[0]),
          display_name: fullName || titleCaseName(normalizedEmail.split('@')[0]),
          user_role: 'employee',
          setup_complete: false,
          manager_email: '',
        });
        users.push(user);
        writeJson(USERS_KEY, users);
      }

      if (fullName && String(fullName).trim()) {
        user = normalizeUser({ ...user, full_name: fullName, display_name: fullName });
      }

      // Sync authoritative fields (especially user_role) from the database on every login.
      try {
        const res = await fetch(`${BACKEND_BASE_URL}/user?email=${encodeURIComponent(normalizedEmail)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.found && data.user) {
            const dbUser = data.user;
            user = normalizeUser({
              ...user,
              user_role: dbUser.user_role || user.user_role,
              setup_complete: dbUser.setup_complete ?? user.setup_complete,
              full_name: dbUser.full_name || user.full_name,
              display_name: dbUser.display_name || dbUser.full_name || user.display_name,
              work_location_tag: dbUser.work_location_tag || user.work_location_tag,
              company_name: dbUser.company_name || user.company_name,
              city_state: dbUser.city_state || user.city_state,
              manager_email: dbUser.manager_email || user.manager_email,
              customer: dbUser.customer || user.customer,
              classification: dbUser.classification || user.classification,
              hourly_rate: dbUser.hourly_rate ?? user.hourly_rate,
              per_diem: dbUser.per_diem || user.per_diem,
              accommodation_allowance: dbUser.accommodation_allowance || user.accommodation_allowance,
              stn_accommodation: dbUser.stn_accommodation || user.stn_accommodation,
              stn_rental: dbUser.stn_rental || user.stn_rental,
              stn_gas: dbUser.stn_gas || user.stn_gas,
              payroll_second_period_start_day: dbUser.payroll_second_period_start_day ?? user.payroll_second_period_start_day,
            });
          }
        }
      } catch {
        // Backend unavailable — proceed with locally cached data.
      }

      setCurrentUser(user);
      setActiveSession(user.email);
      return user;
    },
    async loginWithGoogle({ email, name } = {}) {
      const normalizedEmail = String(email || '').trim().toLowerCase();
      if (!normalizedEmail) throw new Error('Google account email is required');
      return this.login({ email: normalizedEmail, fullName: String(name || '').trim() || undefined });
    },
    async updateMe(patch) {
      const next = normalizeUser({
        ...currentUser(),
        ...patch,
        updated_date: new Date().toISOString(),
      });
      setCurrentUser(next);

      // Persist to DB — fire and forget (don't block or throw on failure)
      try {
        await fetch(`${BACKEND_BASE_URL}/user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: next.email,
            full_name: next.full_name,
            display_name: next.display_name,
            user_role: next.user_role,
            setup_complete: next.setup_complete,
            company_name: next.company_name || null,
            city_state: next.city_state || null,
            manager_email: next.manager_email || null,
            work_location_tag: next.work_location_tag || null,
            customer: next.customer || null,
            classification: next.classification || null,
            hourly_rate: next.hourly_rate || 0,
            per_diem: next.per_diem || null,
            accommodation_allowance: next.accommodation_allowance || null,
            stn_accommodation: next.stn_accommodation || null,
            stn_rental: next.stn_rental || null,
            stn_gas: next.stn_gas || null,
            payroll_second_period_start_day: next.payroll_second_period_start_day ?? null,
            location_enforcement_enabled: next.location_enforcement_enabled ?? false,
          }),
        });
      } catch {
        // Backend unavailable — local save already succeeded.
      }

      return next;
    },
    logout(redirectUrl) {
      clearActiveSession();
      if (redirectUrl) window.location.href = redirectUrl;
    },
    redirectToLogin(redirectUrl) {
      if (redirectUrl) window.location.href = redirectUrl;
      else window.location.href = '/';
    },
  },
  entities: {
    TimesheetEntry: {
      async filter(filterObj = {}, sortExpr, limit) {
        const localRows = readJson(ENTRIES_KEY, []);
        const localFiltered = applyFilter(localRows, filterObj);
        // Prefer DB-backed entries when backend is available.
        try {
          const params = new URLSearchParams();
          for (const [k, v] of Object.entries(filterObj || {})) {
            if (v !== undefined && v !== null && String(v).trim() !== '') {
              params.set(k, String(v).trim());
            }
          }
          if (typeof limit === 'number') params.set('limit', String(limit));

          const query = params.toString();
          const res = await fetch(`${BACKEND_BASE_URL}/timesheet_entries${query ? `?${query}` : ''}`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data?.entries)) {
              const remoteEntries = data.entries;

              // If backend is temporarily stale/empty after local clock-in, keep local UX responsive.
              if (remoteEntries.length === 0 && localFiltered.length > 0) {
                const sortedLocal = applySort(localFiltered, sortExpr);
                return typeof limit === 'number' ? sortedLocal.slice(0, limit) : sortedLocal;
              }

              // Merge local-only pending entries so Clock In -> Clock Out transition is immediate.
              const remoteKeys = new Set(remoteEntries.map((entry) => entryMergeKey(entry)));
              const localOnly = localFiltered.filter((entry) => {
                const key = entryMergeKey(entry);
                return !remoteKeys.has(key);
              });

              const merged = [...remoteEntries, ...localOnly];
              const sortedMerged = applySort(merged, sortExpr);
              return typeof limit === 'number' ? sortedMerged.slice(0, limit) : sortedMerged;
            }
          }
        } catch {
          // Fall back to local cache.
        }

        const filtered = localFiltered;
        const sorted = applySort(filtered, sortExpr);
        return typeof limit === 'number' ? sorted.slice(0, limit) : sorted;
      },
      async create(payload) {
        const rows = readJson(ENTRIES_KEY, []);
        const next = {
          id: uid('entry'),
          created_date: new Date().toISOString(),
          ...payload,
        };
        rows.push(next);
        writeJson(ENTRIES_KEY, rows);
        return next;
      },
      async update(id, patch) {
        return updateRecord(ENTRIES_KEY, id, patch);
      },
    },
    User: {
      async filter(filterObj = {}, sortExpr, limit) {
        // Prefer DB-backed users when backend is available.
        try {
          const params = new URLSearchParams();
          for (const [k, v] of Object.entries(filterObj || {})) {
            if (v !== undefined && v !== null && String(v).trim() !== '') {
              params.set(k, String(v).trim());
            }
          }
          const query = params.toString();
          const res = await fetch(`${BACKEND_BASE_URL}/users${query ? `?${query}` : ''}`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data?.users)) {
              const normalizedRemote = data.users.map(normalizeUser);
              const local = readUsers();
              const byEmail = new Map(local.map((u) => [u.email, u]));
              for (const user of normalizedRemote) byEmail.set(user.email, normalizeUser({ ...byEmail.get(user.email), ...user }));
              writeJson(USERS_KEY, Array.from(byEmail.values()));

              const sortedRemote = applySort(normalizedRemote, sortExpr);
              return typeof limit === 'number' ? sortedRemote.slice(0, limit) : sortedRemote;
            }
          }
        } catch {
          // Fall back to local cache.
        }

        const rows = readUsers();
        const filtered = applyFilter(rows, filterObj);
        const sorted = applySort(filtered, sortExpr);
        return typeof limit === 'number' ? sorted.slice(0, limit) : sorted;
      },
      async update(id, patch) {
        const users = readUsers();
        const existing = users.find((u) => u.id === id) || null;
        const updated = existing
          ? normalizeUser(updateRecord(USERS_KEY, id, patch))
          : normalizeUser({ ...patch, id });
        const idx = users.findIndex((u) => u.id === updated.id);
        if (idx >= 0) {
          users[idx] = updated;
          writeJson(USERS_KEY, users);
        } else if (updated.email) {
          users.push(updated);
          writeJson(USERS_KEY, users);
        }
        if (updated.id === currentUser().id) setCurrentUser(updated);

        // Persist updates to DB when possible.
        try {
          if (updated.email) {
            await fetch(`${BACKEND_BASE_URL}/user`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: updated.email,
                full_name: updated.full_name,
                display_name: updated.display_name,
                user_role: updated.user_role,
                setup_complete: updated.setup_complete,
                company_name: updated.company_name || null,
                customer: updated.customer || updated.company_name || null,
                city_state: updated.city_state || null,
                manager_email: updated.manager_email || null,
                work_location_tag: updated.work_location_tag || null,
                classification: updated.classification || null,
                hourly_rate: updated.hourly_rate || 0,
                per_diem: updated.per_diem || null,
                accommodation_allowance: updated.accommodation_allowance || null,
                stn_accommodation: updated.stn_accommodation || null,
                stn_rental: updated.stn_rental || null,
                stn_gas: updated.stn_gas || null,
                payroll_second_period_start_day: updated.payroll_second_period_start_day ?? null,
              }),
            });
          }
        } catch {
          // Local update already succeeded.
        }

        return updated;
      },
    },
  },
  users: {
    async inviteUser(email, role = 'employee') {
      const manager = currentUser();
      const users = readUsers();
      const normalized = String(email || '').trim().toLowerCase();
      if (!normalized) throw new Error('Email is required');
      if (users.some((u) => u.email === normalized)) return { success: true, existing: true };

      const name = normalized
        .split('@')[0]
        .replace(/[._-]/g, ' ')
        .replace(/\b\w/g, (m) => m.toUpperCase());

      const newUser = {
        id: uid('user'),
        email: normalized,
        full_name: name || 'Invited User',
        display_name: name || 'Invited User',
        user_role: role === 'manager' ? 'manager' : 'employee',
        manager_email: manager.email,
        company_name: manager.company_name || '',
        work_location_tag: '',
        setup_complete: true,
      };

      users.push(newUser);
      writeJson(USERS_KEY, users);
      return { success: true, user: newUser };
    },
  },
  locationTags: {
    async list({ includeInactive = false } = {}) {
      const tags = ensureLocationTags();
      if (includeInactive) return tags;
      return tags.filter((t) => t.is_active);
    },
    async create(payload = {}) {
      const tags = ensureLocationTags();
      const next = normalizeLocationTagRecord(payload);
      if (!next.code) throw new Error('Tag code is required');
      if (!next.county_name) throw new Error('County name is required');
      if (tags.some((t) => t.code === next.code)) {
        throw new Error(`Location tag ${next.code} already exists`);
      }
      const updated = [...tags, next];
      writeJson(LOCATION_TAGS_KEY, updated);
      return next;
    },
    async update(code, patch = {}) {
      const normalizedCode = String(code || '').trim().toUpperCase();
      if (!normalizedCode) throw new Error('Tag code is required');
      const tags = ensureLocationTags();
      const idx = tags.findIndex((t) => t.code === normalizedCode);
      if (idx < 0) throw new Error('Location tag not found');

      const next = normalizeLocationTagRecord({
        ...tags[idx],
        ...patch,
        code: normalizedCode,
        updated_date: new Date().toISOString(),
      });
      tags[idx] = next;
      writeJson(LOCATION_TAGS_KEY, tags);
      return next;
    },
  },
  integrations: {
    Core: {
      async UploadFile({ file }) {
        try {
          const cloudUrl = await uploadFileToCloudinary(file);
          if (cloudUrl) return { file_url: cloudUrl };
        } catch (error) {
          console.warn('Cloud upload failed, falling back to data URL:', error?.message || error);
        }

        // Local fallback keeps existing behavior working when cloud env vars are not configured.
        const file_url = await fileToDataUrl(file);
        return { file_url };
      },
    },
  },
  /**
   * Clear all timesheet entries for a given email from localStorage.
   * Returns the count of removed entries.
   */
  clearLocalEntries(email) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const entries = readJson(ENTRIES_KEY, []);
    const kept = entries.filter(
      (e) => String(e.employee_email || '').toLowerCase() !== normalizedEmail
    );
    writeJson(ENTRIES_KEY, kept);
    return entries.length - kept.length;
  },
};
