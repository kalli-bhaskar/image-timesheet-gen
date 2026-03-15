const USER_KEY = 'timetrack_user';
const USERS_KEY = 'timetrack_users';
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

  return {
    ...user,
    full_name: preferredName,
    display_name: preferredName,
    user_role: user.user_role === 'manager' ? 'manager' : 'employee',
    setup_complete: Boolean(user.setup_complete),
  };
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

  const users = readJson(USERS_KEY, []);
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
  const users = readJson(USERS_KEY, []);
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

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });
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

      const users = readJson(USERS_KEY, []);
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
        const rows = readJson(ENTRIES_KEY, []);
        const filtered = applyFilter(rows, filterObj);
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
        const rows = readJson(USERS_KEY, []);
        const filtered = applyFilter(rows, filterObj);
        const sorted = applySort(filtered, sortExpr);
        return typeof limit === 'number' ? sorted.slice(0, limit) : sorted;
      },
      async update(id, patch) {
        const updated = updateRecord(USERS_KEY, id, patch);
        if (updated.id === currentUser().id) setCurrentUser(updated);
        return updated;
      },
    },
  },
  users: {
    async inviteUser(email, role = 'employee') {
      const manager = currentUser();
      const users = readJson(USERS_KEY, []);
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
        const file_url = await fileToDataUrl(file);
        return { file_url };
      },
    },
  },
};
