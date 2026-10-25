import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/server/firebase-admin";
import { requireAdminAuth, AuthRoleError } from "@/lib/server/auth";
import { normalizePhone } from "@/lib/server/whatsapp-academic-task-creator";
import type { ClassWorkspaceDoc } from "@/types/workspace";

export const runtime = "nodejs";

/**
 * Mask sensitive API tokens for client display (e.g. 7107***abc)
 */
function maskSensitiveToken(token?: string): string {
  if (!token) return "";
  const trimmed = token.trim();
  if (trimmed.length <= 6) return "***";
  return `${trimmed.slice(0, 4)}***${trimmed.slice(-3)}`;
}

/**
 * Normalizes group IDs to ensure proper '@g.us' suffix
 */
function normalizeGroupId(id: string): string {
  const clean = id.trim().replace(/@c\.us$/i, "").replace(/@s\.whatsapp\.net$/i, "");
  if (clean.endsWith("@g.us")) return clean;
  return `${clean.replace(/@.*$/, "")}@g.us`;
}

/**
 * Normalizes workspace slug to start with 'ws_' and contain only alphanumeric, dash, and underscore
 */
function normalizeWorkspaceSlug(slug: string): string {
  let clean = slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  if (!clean.startsWith("ws_")) {
    clean = `ws_${clean}`;
  }
  return clean;
}

/**
 * GET /api/workspaces/classes
 * Lists all academic class workspaces (type === "kelas") for Super Admin
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth(request);
  } catch (authErr) {
    if (authErr instanceof AuthRoleError) {
      return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.statusCode });
    }
    return NextResponse.json({ ok: false, error: "Akses ditolak. Sesi Super Admin diperlukan." }, { status: 403 });
  }

  try {
    const db = getAdminDb();
    const snap = await db.collection("workspaces").where("type", "==", "kelas").get();

    const workspaces = snap.docs.map((doc) => {
      const data = doc.data();
      const gateways = data.whatsapp_settings?.gateways || {};
      
      return {
        id: doc.id,
        name: data.name || "Kelas",
        short_name: data.short_name || data.name || "Kelas",
        type: data.type || "kelas",
        status: data.status || "aktif",
        whatsapp_settings: {
          announcement_group_id:
            data.whatsapp_settings?.announcement_group_id ||
            data.whatsapp_announcement_group_id ||
            data.whatsapp_group_id ||
            "",
          discussion_group_id:
            data.whatsapp_settings?.discussion_group_id ||
            data.whatsapp_discussion_group_id ||
            "",
          gateways: {
            interactive_instance_id: gateways.interactive_instance_id || "",
            interactive_token: maskSensitiveToken(gateways.interactive_token),
            broadcast_instance_id: gateways.broadcast_instance_id || "",
            broadcast_token: maskSensitiveToken(gateways.broadcast_token),
          },
        },
        authorized_admins: data.authorized_admins || {
          admin_1: { phone: "", name: "Admin 1", allow_voice_note_dm: true, allow_voice_note_group: true },
          super_admin: { phone: "6285119459703", name: "Super Admin", allow_voice_note_dm: false, allow_voice_note_group: true },
        },
        created_at: data.created_at,
        created_by: data.created_by,
      };
    });

    return NextResponse.json({ ok: true, workspaces });
  } catch (err) {
    console.error("[GET /api/workspaces/classes] Error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Gagal memuat daftar ruang kerja kelas." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces/classes
 * Creates a new class workspace with structured WhatsApp multi-instance routing
 */
export async function POST(request: NextRequest) {
  let authContext;
  try {
    authContext = await requireAdminAuth(request);
  } catch (authErr) {
    if (authErr instanceof AuthRoleError) {
      return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.statusCode });
    }
    return NextResponse.json({ ok: false, error: "Akses ditolak. Sesi Super Admin diperlukan." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Format payload JSON tidak valid." }, { status: 400 });
  }

  // 1. Validasi Nama Kelas
  const rawName = String(body.name || "").trim();
  if (!rawName || rawName.length < 3) {
    return NextResponse.json({ ok: false, error: "Nama kelas minimal 3 karakter." }, { status: 400 });
  }

  // 2. Validasi & Normalisasi Slug Workspace ID
  const rawSlug = String(body.id || body.slug || rawName).trim();
  const cleanId = normalizeWorkspaceSlug(rawSlug);
  if (!/^ws_[a-z0-9_-]{2,50}$/.test(cleanId)) {
    return NextResponse.json({
      ok: false,
      error: "Slug/ID Workspace harus diawali 'ws_' dan hanya memuat huruf kecil, angka, garis bawah, atau strip (misal: ws_ilkom_b_2024).",
    }, { status: 400 });
  }

  // 3. Validasi ID Grup WhatsApp
  const rawAnnouncementGroup = String(body.announcement_group_id || "").trim();
  const rawDiscussionGroup = String(body.discussion_group_id || "").trim();

  if (!rawAnnouncementGroup) {
    return NextResponse.json({ ok: false, error: "ID Grup Pengumuman Komunitas wajib diisi." }, { status: 400 });
  }
  if (!rawDiscussionGroup) {
    return NextResponse.json({ ok: false, error: "ID Grup Diskusi Kelas wajib diisi." }, { status: 400 });
  }

  const cleanAnnouncementGroup = normalizeGroupId(rawAnnouncementGroup);
  const cleanDiscussionGroup = normalizeGroupId(rawDiscussionGroup);

  if (!/^\d+@g\.us$/.test(cleanAnnouncementGroup)) {
    return NextResponse.json({
      ok: false,
      error: "Format ID Grup Pengumuman tidak valid. Harus berupa ID grup WhatsApp (contoh: 120363411033795051@g.us).",
    }, { status: 400 });
  }
  if (!/^\d+@g\.us$/.test(cleanDiscussionGroup)) {
    return NextResponse.json({
      ok: false,
      error: "Format ID Grup Diskusi tidak valid. Harus berupa ID grup WhatsApp (contoh: 120363432766465224@g.us).",
    }, { status: 400 });
  }

  // 4. Validasi Nomor WhatsApp Admin
  const rawAdmin1Phone = String(body.admin_1_phone || "").trim();
  const cleanAdmin1Phone = normalizePhone(rawAdmin1Phone);
  if (!/^628[0-9]{8,12}$/.test(cleanAdmin1Phone)) {
    return NextResponse.json({
      ok: false,
      error: "Nomor WhatsApp Admin Komunitas 1 tidak valid. Gunakan format standar Indonesia (contoh: 6285119459703).",
    }, { status: 400 });
  }

  const rawAdmin2Phone = String(body.admin_2_phone || "").trim();
  let cleanAdmin2Phone = "";
  if (rawAdmin2Phone) {
    cleanAdmin2Phone = normalizePhone(rawAdmin2Phone);
    if (!/^628[0-9]{8,12}$/.test(cleanAdmin2Phone)) {
      return NextResponse.json({
        ok: false,
        error: "Nomor WhatsApp Admin Komunitas 2 tidak valid. Gunakan format standar Indonesia (contoh: 6281234567890).",
      }, { status: 400 });
    }
  }

  const rawSuperAdminPhone = String(body.super_admin_phone || "6285119459703").trim();
  const cleanSuperAdminPhone = normalizePhone(rawSuperAdminPhone);

  // 5. Validasi Konfigurasi Gateway Green-API (Opsional / Custom)
  const isCustomGateway = body.use_custom_gateway === true;
  const rawGateways = (body.gateways && typeof body.gateways === "object" ? body.gateways : {}) as Record<string, unknown>;

  const interactiveInstanceId = String(rawGateways.interactive_instance_id || "").trim();
  const interactiveToken = String(rawGateways.interactive_token || "").trim();
  const broadcastInstanceId = String(rawGateways.broadcast_instance_id || "").trim();
  const broadcastToken = String(rawGateways.broadcast_token || "").trim();

  if (isCustomGateway) {
    if (!interactiveInstanceId || !interactiveToken) {
      return NextResponse.json({
        ok: false,
        error: "Konfigurasi Gateway Custom memerlukan ID & Token Instance A (Interaktif & VN).",
      }, { status: 400 });
    }
    if (!broadcastInstanceId || !broadcastToken) {
      return NextResponse.json({
        ok: false,
        error: "Konfigurasi Gateway Custom memerlukan ID & Token Instance B (Siaran Pengumuman Outbound).",
      }, { status: 400 });
    }
  }

  const db = getAdminDb();

  // 6. Cek Keberadaan ID Workspace Unik
  const existingDoc = await db.collection("workspaces").doc(cleanId).get();
  if (existingDoc.exists) {
    return NextResponse.json({
      ok: false,
      error: `ID Workspace '${cleanId}' sudah digunakan. Silakan gunakan nama atau slug lain.`,
    }, { status: 409 });
  }

  // 7. Bangun Dokumen Workspace Kelas Sesuai Skema rencana_update.md
  const newWorkspaceDoc: Record<string, unknown> = {
    id: cleanId,
    name: rawName,
    short_name: String(body.short_name || rawName).trim(),
    type: "kelas",
    workspace_type: "kelas",
    status: "aktif",
    institution: "Universitas Pendidikan Ganesha",
    campus_id: "univ-undiksha",
    campus_code: "UNDIKSHA",
    whatsapp_announcement_group_id: cleanAnnouncementGroup,
    whatsapp_discussion_group_id: cleanDiscussionGroup,
    whatsapp_group_id: cleanAnnouncementGroup,
    whatsapp_settings: {
      enabled: true,
      channel_type: "community_announcement",
      announcement_group_id: cleanAnnouncementGroup,
      discussion_group_id: cleanDiscussionGroup,
      group_id: cleanAnnouncementGroup,
      gateways: isCustomGateway
        ? {
            interactive_instance_id: interactiveInstanceId,
            interactive_token: interactiveToken,
            broadcast_instance_id: broadcastInstanceId,
            broadcast_token: broadcastToken,
          }
        : {
            interactive_instance_id: "",
            interactive_token: "",
            broadcast_instance_id: "",
            broadcast_token: "",
          },
    },
    authorized_admins: {
      admin_1: {
        phone: cleanAdmin1Phone,
        name: String(body.admin_1_name || "Admin Komunitas 1").trim(),
        allow_voice_note_dm: true,
        allow_voice_note_group: true,
      },
      ...(cleanAdmin2Phone
        ? {
            admin_2: {
              phone: cleanAdmin2Phone,
              name: String(body.admin_2_name || "Admin Komunitas 2").trim(),
              allow_voice_note_dm: true,
              allow_voice_note_group: true,
            },
          }
        : {}),
      super_admin: {
        phone: cleanSuperAdminPhone,
        name: "Super Admin (Sistem)",
        allow_voice_note_dm: false,
        allow_voice_note_group: true,
      },
    },
    created_by: authContext.uid,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  };

  try {
    await db.collection("workspaces").doc(cleanId).set(newWorkspaceDoc);
    console.log(`[POST /api/workspaces/classes] Successfully created new class workspace: ${cleanId} (${rawName})`);

    return NextResponse.json({
      ok: true,
      workspaceId: cleanId,
      message: `Ruang kerja '${rawName}' berhasil ditambahkan ke sistem.`,
    });
  } catch (err) {
    console.error("[POST /api/workspaces/classes] Firestore write error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Gagal menyimpan ruang kerja kelas ke database." },
      { status: 500 }
    );
  }
}
