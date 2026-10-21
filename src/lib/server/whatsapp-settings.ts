import "server-only";
import { getAdminDb, FieldValue } from "@/lib/server/firebase-admin";
import type { WhatsAppSystemSettings } from "@/types";

export const DEFAULT_SANDBOX_TEST_GROUP_ID = "120363406824082148@g.us";

let cachedSettings: WhatsAppSystemSettings | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 15000; // 15 seconds in-memory cache

export async function getWhatsAppSystemSettings(forceRefresh = false): Promise<WhatsAppSystemSettings> {
  const now = Date.now();
  if (!forceRefresh && cachedSettings && now < cacheExpiry) {
    return cachedSettings;
  }

  try {
    const db = getAdminDb();
    const docSnap = await db.collection("system_settings").doc("whatsapp").get();

    if (docSnap.exists) {
      const data = docSnap.data() || {};
      const isTestMode = Boolean(
        data.isTestMode ?? data.sandbox_mode ?? (process.env.WHATSAPP_SANDBOX_MODE === "true" || process.env.SANDBOX_MODE === "true")
      );
      const testGroupId = (
        data.testGroupId ||
        data.sandbox_group_id ||
        data.sandbox_target ||
        DEFAULT_SANDBOX_TEST_GROUP_ID
      ).trim();

      cachedSettings = {
        isTestMode,
        sandbox_mode: isTestMode,
        testGroupId,
        sandbox_group_id: testGroupId,
        updatedAt: data.updatedAt,
        updatedBy: data.updatedBy,
        updatedByName: data.updatedByName,
      };
    } else {
      const isTestMode = process.env.WHATSAPP_SANDBOX_MODE === "true" || process.env.SANDBOX_MODE === "true";
      cachedSettings = {
        isTestMode,
        sandbox_mode: isTestMode,
        testGroupId: DEFAULT_SANDBOX_TEST_GROUP_ID,
        sandbox_group_id: DEFAULT_SANDBOX_TEST_GROUP_ID,
      };
    }

    cacheExpiry = now + CACHE_TTL_MS;
    return cachedSettings;
  } catch (err) {
    console.error("[WhatsApp Settings] Error fetching system_settings/whatsapp:", err);
    return (
      cachedSettings || {
        isTestMode: false,
        sandbox_mode: false,
        testGroupId: DEFAULT_SANDBOX_TEST_GROUP_ID,
        sandbox_group_id: DEFAULT_SANDBOX_TEST_GROUP_ID,
      }
    );
  }
}

export async function updateWhatsAppSystemSettings(
  settings: Partial<WhatsAppSystemSettings>,
  userId?: string,
  userName?: string
): Promise<void> {
  const db = getAdminDb();
  const docRef = db.collection("system_settings").doc("whatsapp");

  const payload: Record<string, unknown> = {
    ...settings,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (userId) payload.updatedBy = userId;
  if (userName) payload.updatedByName = userName;

  await docRef.set(payload, { merge: true });

  // Invalidate cache immediately
  cachedSettings = null;
  cacheExpiry = 0;
}
