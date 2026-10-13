/* One-time first-admin provisioning (see docs/FIRST_ADMIN.md).
 *
 * Creates the Firebase Auth user (email verified) and the Firestore documents the security rules
 * refuse to let clients create: systemMeta/counters, employees/EMP-0001 (role admin),
 * employeeAuthorizations/<email>, directory/EMP-0001 and workplaceSettings/main.
 *
 * Uses the credentials of whoever is logged in to the Firebase CLI (`firebase login`), i.e. a trusted
 * project owner. Nothing secret is stored in the repo: pass the password through the environment.
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... ADMIN_FIRST=You ADMIN_LAST=Admin \
 *   FIREBASE_PROJECT=platnumx node scripts/provision-admin.cjs
 */
const path = require("node:path");
const { execSync } = require("node:child_process");

const ftRoot = path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "firebase-tools", "lib");
const auth = require(path.join(ftRoot, "auth.js"));

const project = process.env.FIREBASE_PROJECT;
const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || "";
const first = process.env.ADMIN_FIRST || "Admin";
const last = process.env.ADMIN_LAST || "";
if (!project || !email || password.length < 8) {
  console.error("Set FIREBASE_PROJECT, ADMIN_EMAIL and ADMIN_PASSWORD (min 8 chars).");
  process.exit(1);
}

const SCOPES = ["https://www.googleapis.com/auth/cloud-platform"];

async function token() {
  const account = auth.getGlobalDefaultAccount();
  if (!account) throw new Error("Not logged in. Run `firebase login` first.");
  const t = await auth.getAccessToken(account.tokens.refresh_token, SCOPES);
  return typeof t === "string" ? t : t.access_token;
}

async function call(bearer, method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json", "x-goog-user-project": project },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const err = new Error(json?.error?.message || res.statusText);
    err.status = res.status;
    throw err;
  }
  return json;
}

async function ensureAuthUser(bearer) {
  const base = `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts`;
  const displayName = `${first} ${last}`.trim();
  try {
    const u = await call(bearer, "POST", base, { email, password, emailVerified: true, displayName });
    console.log("Auth user created:", u.localId);
    return u.localId;
  } catch (e) {
    if (e.message !== "EMAIL_EXISTS") throw e;
    const found = await call(bearer, "POST", `${base}:lookup`, { email: [email] });
    const uid = found.users[0].localId;
    await call(bearer, "POST", `${base}:update`, { localId: uid, password, emailVerified: true, displayName });
    console.log("Auth user already existed; password/verification refreshed:", uid);
    return uid;
  }
}

const str = (stringValue) => ({ stringValue });
const ts = (d) => ({ timestampValue: d.toISOString() });
const int = (n) => ({ integerValue: String(n) });

async function seedFirestore(bearer) {
  const now = new Date();
  const root = `projects/${project}/databases/(default)/documents`;
  const w = (p, fields) => ({ update: { name: `${root}/${p}`, fields } });
  await call(bearer, "POST", `https://firestore.googleapis.com/v1/${root}:commit`, {
    writes: [
      w("systemMeta/counters", { employeeSeq: int(1) }),
      w("employees/EMP-0001", {
        firstName: str(first), lastName: str(last), email: str(email), phone: str(""), title: str("Administrator"),
        role: str("admin"), status: str("active"), createdBy: str("EMP-0001"), createdAt: ts(now), updatedAt: ts(now),
      }),
      w(`employeeAuthorizations/${email}`, { employeeId: str("EMP-0001"), claimedByUid: { nullValue: null } }),
      w("directory/EMP-0001", { displayName: str(`${first} ${last}`.trim()), title: str("Administrator"), status: str("active") }),
      w("workplaceSettings/main", {
        businessName: str("PlatinumX"), timezone: str("UTC"), clockInEarlyMinutes: int(15), clockInLateMinutes: int(120),
        updatedBy: str("EMP-0001"), updatedAt: ts(now),
      }),
    ],
  });
  console.log("Firestore seeded: counters, EMP-0001 (admin), authorization, directory, settings.");
}

(async () => {
  const bearer = await token();
  await ensureAuthUser(bearer);
  await seedFirestore(bearer);
})().catch((e) => {
  console.error("Provisioning failed:", e.message);
  process.exit(1);
});
