import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { readJsonFile, writeJsonFile } from "./store";
import { getExhibitionStatsByUserId } from "./exhibitions";
import { getUserDataStatsByUserId } from "./user-data";

export type UserRole = "user" | "admin";

export type AuthUserRecord = {
  id: number; // numeric account id
  museId: string; // login credential, numeric for regular users and named for admin accounts
  passwordHash: string;
  phone?: string;
  email?: string;
  createdAt: string;
  profile: {
    displayName: string;
    photoURL: string;
    headerUrl: string;
    bio: string;
    gender?: "male" | "female" | "other" | "secret";
    birthday?: string;
    location?: string;
    role: UserRole;
    privacySettings: { profileVisibility: "all" | "followers" };
    stats: {
      favArtifacts: number;
      myExhibitions: number;
      favExhibitions: number;
      likes: number;
      following: number;
      followers: number;
    };
  };
};

type AuthDb = {
  version: 1;
  users: AuthUserRecord[];
};

type LoginChannel = "phone" | "email";
type PendingCode = {
  code: string;
  channel: LoginChannel;
  target: string;
  expiresAt: number;
};

const USERS_FILE = "auth-users.json";
const SEQ_FILE = "auth-user-seq.json";
const DEFAULT_ADMIN_MUSE_ID = "jiangzhong";
const DEFAULT_ADMIN_PASSWORD = "jiangzhong";
const DEFAULT_ADMIN_DISPLAY_NAME = "犟种";
const pendingLoginCodes = new Map<string, PendingCode>();

function nowIso() {
  return new Date().toISOString();
}

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Missing JWT_SECRET in environment (.env.local).");
  }
  return secret;
}

function createDefaultProfile(museId: string, role: UserRole, displayName?: string): AuthUserRecord["profile"] {
  return {
    displayName: displayName || `MuseLink ${museId}`,
    photoURL:
      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200",
    headerUrl:
      "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=1200",
    bio: "",
    role,
    privacySettings: { profileVisibility: "all" },
    stats: {
      favArtifacts: 0,
      myExhibitions: 0,
      favExhibitions: 0,
      likes: 0,
      following: 0,
      followers: 0,
    },
  };
}

async function ensureAdminAccount(db: AuthDb): Promise<AuthDb> {
  const existingAdmin = db.users.find((user) => user.museId === DEFAULT_ADMIN_MUSE_ID);
  if (existingAdmin) {
    let changed = false;
    if (existingAdmin.profile.role !== "admin") {
      existingAdmin.profile.role = "admin";
      changed = true;
    }

    const passwordMatchesDefault = await bcrypt.compare(DEFAULT_ADMIN_PASSWORD, existingAdmin.passwordHash);
    if (!passwordMatchesDefault) {
      existingAdmin.passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);
      changed = true;
    }

    if (changed) {
      await saveAuthDb(db);
    }
    return db;
  }

  const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);
  const id = await nextUserId();
  db.users.unshift({
    id,
    museId: DEFAULT_ADMIN_MUSE_ID,
    passwordHash,
    createdAt: nowIso(),
    profile: createDefaultProfile(DEFAULT_ADMIN_MUSE_ID, "admin", DEFAULT_ADMIN_DISPLAY_NAME),
  });
  await saveAuthDb(db);
  return db;
}

export async function loadAuthDb(): Promise<AuthDb> {
  const db = await readJsonFile<AuthDb>(USERS_FILE, { version: 1, users: [] });
  const normalized = normalizeAuthDbContacts(db);
  if (normalized) {
    await saveAuthDb(db);
  }
  return ensureAdminAccount(db);
}

export async function saveAuthDb(db: AuthDb): Promise<void> {
  await writeJsonFile(USERS_FILE, db);
}

function normalizeAuthDbContacts(db: AuthDb) {
  let changed = false;
  const seenPhones = new Set<string>();
  const seenEmails = new Set<string>();
  const normalizedUsers: AuthUserRecord[] = [];

  for (const user of db.users) {
    if (user.phone) {
      const phone = normalizePhone(user.phone);
      if (phone !== user.phone) {
        user.phone = phone;
        changed = true;
      }
      if (seenPhones.has(phone)) {
        changed = true;
        continue;
      }
      seenPhones.add(phone);
    }

    if (user.email) {
      const email = normalizeEmail(user.email);
      if (email !== user.email) {
        user.email = email;
        changed = true;
      }
      if (seenEmails.has(email)) {
        changed = true;
        continue;
      }
      seenEmails.add(email);
    }

    normalizedUsers.push(user);
  }

  if (normalizedUsers.length !== db.users.length) {
    db.users = normalizedUsers;
  }

  return changed;
}

async function nextUserId(): Promise<number> {
  const seq = await readJsonFile<{ nextId: number }>(SEQ_FILE, { nextId: 100000 }); // start with 6 digits
  const id = seq.nextId;
  await writeJsonFile(SEQ_FILE, { nextId: id + 1 });
  return id;
}

function randomDigits(length: number) {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += Math.floor(Math.random() * 10).toString();
  }
  // avoid leading 0 for nicer UX
  if (out[0] === "0") {
    out = String(1 + Math.floor(Math.random() * 9)) + out.slice(1);
  }
  return out;
}

function normalizePhone(value: string) {
  const compact = value.replace(/[\s\-()]/g, "").trim();
  const digits = compact.startsWith("+") ? compact.slice(1) : compact;

  if (/^(?:0086|86)?1\d{10}$/.test(digits)) {
    return digits.replace(/^(?:0086|86)/, "");
  }

  return compact;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeLoginTarget(channel: LoginChannel, value: string) {
  return channel === "phone" ? normalizePhone(value) : normalizeEmail(value);
}

function getLoginCodeKey(channel: LoginChannel, target: string) {
  return `${channel}:${target}`;
}

function validateLoginTarget(channel: LoginChannel, target: string) {
  if (channel === "phone") {
    if (!/^\+?\d{10,15}$/.test(target)) {
      throw new Error("请输入有效手机号。");
    }
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
    throw new Error("请输入有效邮箱。");
  }
}

function createContactDisplayName(channel: LoginChannel, target: string) {
  if (channel === "phone") {
    const tail = target.slice(-4);
    return `MuseLink ${tail}`;
  }
  return target.split("@")[0] || "MuseLink User";
}

export async function generateMuseId(db: AuthDb): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const len = 8 + Math.floor(Math.random() * 3); // 8-10
    const museId = randomDigits(len);
    const exists = db.users.some((u) => u.museId === museId);
    if (!exists) return museId;
  }
  throw new Error("Failed to generate unique MuseLink ID. Please retry.");
}

export async function registerUser(options: {
  password: string;
  confirmPassword: string;
}): Promise<{ museId: string }> {
  if (options.password.length < 8 || options.password.length > 64) {
    throw new Error("密码至少 8 位，且不超过 64 位。");
  }
  if (options.password !== options.confirmPassword) {
    throw new Error("两次输入的密码不一致。");
  }

  const db = await loadAuthDb();
  const id = await nextUserId();
  const museId = await generateMuseId(db);
  const passwordHash = await bcrypt.hash(options.password, 12);

  db.users.push({
    id,
    museId,
    passwordHash,
    createdAt: nowIso(),
    profile: createDefaultProfile(museId, "user"),
  });

  await saveAuthDb(db);
  return { museId };
}

export async function loginUser(options: {
  museId: string;
  password: string;
}): Promise<{ token: string; museId: string; role: UserRole }> {
  const db = await loadAuthDb();
  const museId = options.museId.trim();
  const user = db.users.find((u) => u.museId === museId);
  if (!user) {
    throw new Error("ID不存在");
  }
  const ok = await bcrypt.compare(options.password, user.passwordHash);
  if (!ok) {
    throw new Error("密码错误");
  }

  const token = jwt.sign(
    { sub: String(user.id), role: user.profile.role, museId: user.museId },
    jwtSecret(),
    { expiresIn: "7d" },
  );
  return { token, museId: user.museId, role: user.profile.role };
}

export async function requestLoginCode(options: {
  channel: LoginChannel;
  target: string;
}): Promise<{ expiresIn: number; devCode: string }> {
  const target = normalizeLoginTarget(options.channel, options.target);
  validateLoginTarget(options.channel, target);

  const code = randomDigits(6);
  const expiresIn = 5 * 60;
  pendingLoginCodes.set(getLoginCodeKey(options.channel, target), {
    code,
    channel: options.channel,
    target,
    expiresAt: Date.now() + expiresIn * 1000,
  });

  return { expiresIn, devCode: code };
}

export async function loginWithCode(options: {
  channel: LoginChannel;
  target: string;
  code: string;
}): Promise<{ token: string; museId: string; role: UserRole }> {
  const target = normalizeLoginTarget(options.channel, options.target);
  const code = options.code.trim();
  validateLoginTarget(options.channel, target);
  if (!/^\d{6}$/.test(code)) {
    throw new Error("验证码必须是 6 位数字。");
  }

  const key = getLoginCodeKey(options.channel, target);
  const pending = pendingLoginCodes.get(key);
  if (!pending || pending.code !== code) {
    throw new Error("验证码错误。");
  }
  if (pending.expiresAt < Date.now()) {
    pendingLoginCodes.delete(key);
    throw new Error("验证码已过期，请重新获取。");
  }

  pendingLoginCodes.delete(key);

  const db = await loadAuthDb();
  let user = db.users.find((candidate) =>
    options.channel === "phone" ? candidate.phone === target : candidate.email === target,
  );

  if (!user) {
    const id = await nextUserId();
    const museId = await generateMuseId(db);
    user = {
      id,
      museId,
      passwordHash: "",
      [options.channel]: target,
      createdAt: nowIso(),
      profile: createDefaultProfile(museId, "user", createContactDisplayName(options.channel, target)),
    };
    db.users.push(user);
    await saveAuthDb(db);
  }

  const token = jwt.sign(
    { sub: String(user.id), role: user.profile.role, museId: user.museId },
    jwtSecret(),
    { expiresIn: "7d" },
  );
  return { token, museId: user.museId, role: user.profile.role };
}

export function verifyToken(token: string): { userId: number; role?: UserRole } {
  const payload = jwt.verify(token, jwtSecret()) as jwt.JwtPayload;
  const sub = payload.sub;
  const userId = typeof sub === "string" ? Number(sub) : NaN;
  if (!Number.isFinite(userId)) {
    throw new Error("Invalid token subject.");
  }
  const role = payload.role === "admin" || payload.role === "user" ? payload.role : undefined;
  return { userId, role };
}

export type AuthedRequest = Request & { auth?: { userId: number; role?: UserRole } };

function authenticateRequest(req: AuthedRequest) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new Error("Missing Authorization Bearer token.");
  }

  const token = header.slice("Bearer ".length).trim();
  const auth = verifyToken(token);
  req.auth = auth;
  return auth;
}

export function authMiddleware(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    authenticateRequest(req);
    return next();
  } catch (err) {
    return res.status(401).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const auth = authenticateRequest(req);
    if (auth.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: admin access required." });
    }
    return next();
  } catch (err) {
    return res.status(401).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function getUserPublicProfile(userId: number) {
  const db = await loadAuthDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) return null;
  return {
    id: user.id,
    museId: user.museId,
    createdAt: user.createdAt,
    profile: user.profile,
  };
}

export async function updateUserProfile(userId: number, patch: Partial<AuthUserRecord["profile"]>) {
  const db = await loadAuthDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) {
    throw new Error("User not found.");
  }

  const displayName =
    typeof patch.displayName === "string" ? patch.displayName.trim().slice(0, 24) : user.profile.displayName;
  const bio = typeof patch.bio === "string" ? patch.bio.trim().slice(0, 120) : user.profile.bio;
  const location =
    typeof patch.location === "string" ? patch.location.trim().slice(0, 40) : user.profile.location;
  const birthday =
    typeof patch.birthday === "string" && /^\d{4}-\d{2}-\d{2}$/.test(patch.birthday)
      ? patch.birthday
      : user.profile.birthday;
  const gender =
    patch.gender === "male" || patch.gender === "female" || patch.gender === "other" || patch.gender === "secret"
      ? patch.gender
      : user.profile.gender;
  const profileVisibility =
    patch.privacySettings?.profileVisibility === "followers" ? "followers" : user.profile.privacySettings.profileVisibility;

  user.profile = {
    ...user.profile,
    displayName,
    bio,
    location,
    birthday,
    gender,
    photoURL: typeof patch.photoURL === "string" ? patch.photoURL.trim().slice(0, 500) : user.profile.photoURL,
    headerUrl: typeof patch.headerUrl === "string" ? patch.headerUrl.trim().slice(0, 500) : user.profile.headerUrl,
    privacySettings: patch.privacySettings
      ? { ...user.profile.privacySettings, profileVisibility }
      : user.profile.privacySettings,
    stats: user.profile.stats,
  };

  await saveAuthDb(db);
  return {
    id: user.id,
    createdAt: user.createdAt,
    profile: user.profile,
  };
}

export async function listAdminUsers() {
  const [db, userDataStats, exhibitionStats] = await Promise.all([
    loadAuthDb(),
    getUserDataStatsByUserId(),
    getExhibitionStatsByUserId(),
  ]);

  return db.users.map((user) => ({
    id: user.id,
    museId: user.museId || null,
    createdAt: user.createdAt,
    role: user.profile.role,
    displayName: user.profile.displayName,
    photoURL: user.profile.photoURL,
    headerUrl: user.profile.headerUrl,
    bio: user.profile.bio,
    gender: user.profile.gender || "secret",
    birthday: user.profile.birthday || "",
    location: user.profile.location || "",
    profileVisibility: user.profile.privacySettings.profileVisibility,
    contact: {
      email: user.email || "",
      phone: user.phone || "",
      hasPassword: Boolean(user.passwordHash),
    },
    activity: {
      favoriteArtifacts: userDataStats[String(user.id)]?.favoriteArtifacts ?? 0,
      favoriteExhibitions: userDataStats[String(user.id)]?.favoriteExhibitions ?? 0,
      exhibitions: exhibitionStats[String(user.id)]?.exhibitions ?? 0,
      publicExhibitions: exhibitionStats[String(user.id)]?.publicExhibitions ?? 0,
    },
  }));
}

export async function getAdminStats() {
  const [db, userDataStats, exhibitionStats] = await Promise.all([
    loadAuthDb(),
    getUserDataStatsByUserId(),
    getExhibitionStatsByUserId(),
  ]);
  const museIds = new Set(
    db.users
      .map((user) => user.museId?.trim())
      .filter((museId): museId is string => Boolean(museId)),
  );
  const usersWithContact = db.users.filter((user) => Boolean(user.phone || user.email)).length;
  const totalFavoriteArtifacts = Object.values(userDataStats).reduce(
    (sum, stats) => sum + stats.favoriteArtifacts,
    0,
  );
  const totalFavoriteExhibitions = Object.values(userDataStats).reduce(
    (sum, stats) => sum + stats.favoriteExhibitions,
    0,
  );
  const totalExhibitions = Object.values(exhibitionStats).reduce((sum, stats) => sum + stats.exhibitions, 0);
  const publicExhibitions = Object.values(exhibitionStats).reduce(
    (sum, stats) => sum + stats.publicExhibitions,
    0,
  );

  return {
    totalUsers: db.users.length,
    adminCount: db.users.filter((user) => user.profile.role === "admin").length,
    museIdCount: museIds.size,
    usersWithContact,
    passwordLoginCount: db.users.filter((user) => Boolean(user.passwordHash)).length,
    codeLoginCount: db.users.filter((user) => !user.passwordHash && Boolean(user.phone || user.email)).length,
    totalFavoriteArtifacts,
    totalFavoriteExhibitions,
    totalExhibitions,
    publicExhibitions,
  };
}
