import "server-only";

import { FieldValue, getAdminDb } from "@/lib/server/firebase-admin";
import { resolveTaskNotificationTarget } from "@/lib/server/group-routing";
import { sendWhatsAppMessage } from "@/lib/server/whatsapp";
import type { Event, Task, UserProfile } from "@/types";

export interface JobdeskBriefBroadcastResult {
  ok: boolean;
  sent: boolean;
  target?: string;
  reason?: string;
  error?: string;
}

/**
 * Format date in Indonesian locale with WITA time zone
 */
function formatDeadlineWita(deadline: unknown): string {
  if (!deadline) {
    return "Belum ditentukan";
  }

  let dateObj: Date | null = null;
  if (typeof (deadline as { toDate?: () => Date }).toDate === "function") {
    dateObj = (deadline as { toDate: () => Date }).toDate();
  } else if (deadline instanceof Date) {
    dateObj = deadline;
  } else if (typeof deadline === "string") {
    dateObj = new Date(deadline);
  }

  if (!dateObj || isNaN(dateObj.getTime())) {
    return "Belum ditentukan";
  }

  try {
    const formatted = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Makassar",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(dateObj);

    return `${formatted} WITA`;
  } catch {
    return dateObj.toLocaleDateString("id-ID") + " WITA";
  }
}

/**
 * Maps task priority to Indonesian text with emoji
 */
function formatPriorityLabel(priority?: string): string {
  switch (priority) {
    case "tinggi":
      return "Tinggi 🔴";
    case "rendah":
      return "Rendah 🟢";
    case "sedang":
    default:
      return "Sedang 🟡";
  }
}

/**
 * Normalizes Indonesian phone number to international format (628...)
 */
function normalizePhoneNumber(rawPhone?: string): string {
  if (!rawPhone) return "";
  const cleaned = rawPhone.replace(/\D/g, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("0")) {
    return `62${cleaned.slice(1)}`;
  }
  if (cleaned.startsWith("8")) {
    return `62${cleaned}`;
  }
  return cleaned;
}

/**
 * Sends "Brief Siap Kerjakan" WhatsApp broadcast to event group / division group / PICs
 * when a coordinator or admin updates jobdesk brief, Drive links, references, or palettes.
 *
 * @param taskId - ID of the task in Firestore
 * @param updaterUserId - User ID of the coordinator/admin who updated the materials
 */
export async function sendJobdeskBriefReadyBroadcast(
  taskId: string,
  updaterUserId: string
): Promise<JobdeskBriefBroadcastResult> {
  const db = getAdminDb();

  // 1. Fetch task
  const taskSnap = await db.collection("tasks").doc(taskId).get();
  if (!taskSnap.exists) {
    return { ok: false, sent: false, error: "Task tidak ditemukan." };
  }

  const task = {
    id: taskSnap.id,
    ...taskSnap.data(),
  } as Task;

  // 2. Fetch updater profile
  let updaterName = "Koordinator";
  if (updaterUserId) {
    try {
      const updaterSnap = await db.collection("users").doc(updaterUserId).get();
      if (updaterSnap.exists) {
        const uData = updaterSnap.data() as UserProfile;
        updaterName = uData?.name || uData?.email || updaterName;
      }
    } catch (err) {
      console.warn("[BriefBroadcast] Failed to fetch updater profile:", err);
    }
  }

  // 3. Fetch event data if available
  let event: Event | null = null;
  let eventName = "Kepanitiaan";
  let eventGroupId = "";

  if (task.event_id) {
    try {
      const eventSnap = await db.collection("events").doc(task.event_id).get();
      if (eventSnap.exists) {
        event = { id: eventSnap.id, ...eventSnap.data() } as Event;
        eventName = event.name || "Kepanitiaan";
        eventGroupId = event.whatsapp_group_id || "";
      }
    } catch (err) {
      console.warn("[BriefBroadcast] Failed to fetch event doc:", err);
    }
  } else if (task.division_id) {
    try {
      const divSnap = await db.collection("divisions").doc(task.division_id).get();
      if (divSnap.exists) {
        const divData = divSnap.data();
        eventName = divData?.name || "Divisi";
      }
    } catch {
      // ignore
    }
  }

  // 4. Fetch PIC profiles & construct mentions
  const picUserIds = Array.from(
    new Set(
      [
        ...(Array.isArray(task.pic_ids) ? task.pic_ids : []),
        task.pic_id,
      ].filter((id): id is string => Boolean(id && typeof id === "string" && id.trim()))
    )
  );

  const picPhoneNumbers: string[] = [];
  const picMentionStrings: string[] = [];

  for (const pid of picUserIds) {
    try {
      const pSnap = await db.collection("users").doc(pid).get();
      if (pSnap.exists) {
        const pData = pSnap.data() as UserProfile & { phone?: string; phone_number?: string };
        const rawPhone = pData.whatsapp_number || pData.phone_number || pData.phone || "";
        const normPhone = normalizePhoneNumber(rawPhone);
        const pName = pData.name || "Anggota";

        if (normPhone) {
          picPhoneNumbers.push(normPhone);
          picMentionStrings.push(`@${normPhone} (${pName})`);
        } else {
          picMentionStrings.push(`• ${pName}`);
        }
      }
    } catch (err) {
      console.warn(`[BriefBroadcast] Failed to fetch PIC ${pid}:`, err);
    }
  }

  let listMentionsPIC = "";
  if (picMentionStrings.length === 0) {
    listMentionsPIC = "• *(Belum ada PIC yang ditugaskan)*";
  } else if (picMentionStrings.length === 1) {
    listMentionsPIC = picMentionStrings[0];
  } else if (picMentionStrings.length === 2) {
    listMentionsPIC = `${picMentionStrings[0]} & ${picMentionStrings[1]}`;
  } else {
    listMentionsPIC = picMentionStrings.join("\n");
  }

  // 5. Extract Materials & References
  const drive_url =
    (task.drive_ref_links && task.drive_ref_links[0]?.url) ||
    task.drive_reference_url ||
    (task as unknown as Record<string, string>).drive_url ||
    "";

  const reference_url =
    (task.design_ref_links && task.design_ref_links[0]?.url) ||
    task.design_reference_url ||
    (task.redaction_links && task.redaction_links[0]?.url) ||
    task.copywriting_docs_url ||
    (task as unknown as Record<string, string>).reference_url ||
    "";

  let color_palette = "";
  if (Array.isArray(task.color_palette) && task.color_palette.length > 0) {
    color_palette = task.color_palette.join(", ");
  } else if (typeof task.color_palette === "string") {
    color_palette = task.color_palette;
  }

  const visual_direction = (task.visual_direction || "").trim();
  const brief = (
    task.copywriting ||
    (task as unknown as Record<string, string>).copywriting_brief ||
    task.description ||
    (task as unknown as Record<string, string>).brief ||
    ""
  ).trim();

  const formattedDeadline = formatDeadlineWita(task.deadline);
  const priorityText = formatPriorityLabel(task.priority);

  // 6. Build Materials Lines
  const materialLines: string[] = [];
  if (drive_url) {
    materialLines.push(`• *Google Drive Materi:* ${drive_url}`);
  }
  if (reference_url) {
    materialLines.push(`• *Referensi Desain:* ${reference_url}`);
  }
  if (color_palette) {
    materialLines.push(`• *Palet Warna:* ${color_palette}`);
  }
  if (visual_direction) {
    materialLines.push(`• *Arahan Visual:* ${visual_direction}`);
  }
  if (brief) {
    materialLines.push(`• *Ringkasan Brief:* ${brief}`);
  }

  const materialsSection =
    materialLines.length > 0
      ? materialLines.join("\n")
      : "• *(Materi & arahan telah diperbarui di dashboard JobDex)*";

  // 7. Format WhatsApp Message (Single asterisk *bold* only, strictly NO **)
  const message = [
    "🎨 *BRIEF & MATERI JOBDESK SUDAH SIAP!* ✨",
    "",
    `Halo rekan-rekan panitia *${eventName}*! Materi dan arahan pengerjaan untuk tugas berikut baru saja diperbarui oleh *${updaterName}*:`,
    "",
    `📌 *Jobdesk:* ${task.name || (task as unknown as Record<string, string>).title || "Tugas Acara"}`,
    `⏰ *Tenggat:* ${formattedDeadline}`,
    `⚡ *Prioritas:* ${priorityText}`,
    "",
    "👥 *PIC Ditugaskan:*",
    listMentionsPIC,
    "",
    "📁 *Kelengkapan Materi & Referensi:*",
    materialsSection,
    "",
    "Yuk rekan-rekan PIC mulai gas eksekusi tugasnya ya! Kalau ada kendala teknis atau materi yang kurang jelas, langsung diskusikan di grup ini. Semangat pol-polan! 🔥💪",
    "",
    "👉 *Cek detail & update progress:*",
    "https://jobdexin.sumestawsome.xyz/dashboard/tasks",
  ].join("\n");

  // 8. Determine destination target
  // Priority: event.whatsapp_group_id > resolved group routing > direct to PICs
  let targetRecipient = eventGroupId;
  let isGroup = Boolean(eventGroupId);

  if (!targetRecipient) {
    try {
      const resolvedTarget = await resolveTaskNotificationTarget(task);
      if (resolvedTarget && resolvedTarget.recipient) {
        targetRecipient = resolvedTarget.recipient;
        isGroup = resolvedTarget.targetType !== "personal";
      }
    } catch (err) {
      console.warn("[BriefBroadcast] Failed to resolve target via group-routing:", err);
    }
  }

  const taskOrgId = task.org_id || task.orgId || task.organization_id || "main_org";

  // If still no group target, send directly to each PIC's phone number
  if (!targetRecipient && picPhoneNumbers.length > 0) {
    let anySent = false;
    for (const phone of picPhoneNumbers) {
      try {
        const sendResult = await sendWhatsAppMessage({
          target: phone,
          message,
          type: "phone",
          mentions: [phone],
          org_id: taskOrgId,
        });
        if (sendResult.ok) anySent = true;
      } catch (err) {
        console.error(`[BriefBroadcast] Failed direct message to ${phone}:`, err);
      }
    }

    // Record log
    try {
      await db.collection("whatsapp_logs").add({
        task_id: taskId,
        organization_id: taskOrgId,
        event_type: "jobdesk_brief_ready",
        message_content: message,
        recipient: picPhoneNumbers.join(", "),
        recipient_type: "personal",
        status: anySent ? "sent" : "failed",
        created_at: FieldValue.serverTimestamp(),
      });
    } catch {
      // ignore log error
    }

    return {
      ok: anySent,
      sent: anySent,
      target: picPhoneNumbers.join(", "),
      reason: "Sent directly to PIC phone numbers (no event group configured)",
    };
  }

  if (!targetRecipient) {
    return {
      ok: false,
      sent: false,
      error: "Grup WhatsApp acara belum dikonfigurasi dan tidak ada nomor HP PIC yang valid.",
    };
  }

  // 9. Dispatch WhatsApp Message to Group with PIC mentions
  try {
    const sendResult = await sendWhatsAppMessage({
      target: targetRecipient,
      message,
      type: isGroup ? "group" : "phone",
      mentions: picPhoneNumbers,
      org_id: taskOrgId,
    });

    // Record audit log in whatsapp_logs
    try {
      await db.collection("whatsapp_logs").add({
        task_id: taskId,
        organization_id: taskOrgId,
        event_type: "jobdesk_brief_ready",
        message_content: message,
        recipient: targetRecipient,
        recipient_group_id: isGroup ? targetRecipient : "",
        recipient_type: isGroup ? "group" : "personal",
        is_group: isGroup,
        status: sendResult.ok ? "sent" : (sendResult.skipped ? "skipped" : "failed"),
        provider: sendResult.provider,
        ...(sendResult.error ? { error_message: sendResult.error } : {}),
        created_at: FieldValue.serverTimestamp(),
      });
    } catch (logErr) {
      console.warn("[BriefBroadcast] Failed to record whatsapp_logs:", logErr);
    }

    // Mark task document with brief broadcast timestamp
    try {
      await db.collection("tasks").doc(taskId).update({
        brief_notified_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });
    } catch {
      // ignore
    }

    return {
      ok: sendResult.ok,
      sent: sendResult.ok,
      target: targetRecipient,
      reason: sendResult.skipped ? sendResult.error : undefined,
    };
  } catch (sendErr) {
    const errorMsg = sendErr instanceof Error ? sendErr.message : String(sendErr);
    console.error("[BriefBroadcast] WhatsApp dispatch error:", errorMsg);

    try {
      await db.collection("whatsapp_logs").add({
        task_id: taskId,
        organization_id: taskOrgId,
        event_type: "jobdesk_brief_ready",
        message_content: message,
        recipient: targetRecipient,
        status: "failed",
        error_message: errorMsg,
        created_at: FieldValue.serverTimestamp(),
      });
    } catch {
      // ignore
    }

    return {
      ok: false,
      sent: false,
      target: targetRecipient,
      error: errorMsg,
    };
  }
}
