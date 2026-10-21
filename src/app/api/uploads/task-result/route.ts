import { NextResponse, type NextRequest } from "next/server";
import { validateFileUpload } from "@/lib/upload-validation";
import { buildCloudinaryThumbnail, uploadImageBuffer, validateCloudinaryConfig } from "@/lib/server/cloudinary";
import { canUploadTaskResult, getServerAuthContext } from "@/lib/server/auth";
import { FieldValue, getAdminDb } from "@/lib/server/firebase-admin";
import { notifyTaskEvent } from "@/lib/server/notifications";
import type { Task } from "@/types";
import { recalculateEventProgressAdmin } from "@/lib/server/whatsapp-command-executor";

export const runtime = "nodejs";

function getSourceLinkType(url?: string): "canva" | "figma" | "google_docs" | "google_sheets" | "google_drive" | "other" | undefined {
  if (!url) return undefined;
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes("canva.com")) return "canva";
  if (lowerUrl.includes("figma.com")) return "figma";
  if (lowerUrl.includes("docs.google.com/document")) return "google_docs";
  if (lowerUrl.includes("docs.google.com/spreadsheets")) return "google_sheets";
  if (lowerUrl.includes("drive.google.com")) return "google_drive";
  return "other";
}

export async function POST(request: NextRequest) {
  // 1. Validasi Kredensial Cloudinary di awal (mencegah silent crash)
  const cldConfig = validateCloudinaryConfig();
  if (!cldConfig.valid) {
    console.error("[api/uploads/task-result] Kredensial Cloudinary belum lengkap:", cldConfig.error);
    return NextResponse.json(
      { error: cldConfig.error || "Layanan penyimpanan Cloudinary belum dikonfigurasi di server." },
      { status: 500 }
    );
  }

  // 2. Validasi Autentikasi
  let profile;
  try {
    const authContext = await getServerAuthContext(request);
    profile = authContext.profile;
  } catch (authError) {
    const msg = authError instanceof Error ? authError.message : "Autentikasi diperlukan.";
    return NextResponse.json(
      { error: msg },
      { status: 401 }
    );
  }

  // 3. Parsing Multipart Form-Data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (formError) {
    console.warn("[api/uploads/task-result] Gagal parse form-data:", formError);
    return NextResponse.json(
      { error: "Gagal memproses multipart form-data. Pastikan payload terkirim sebagai format form-data yang valid." },
      { status: 400 }
    );
  }

  try {
    const taskId = formData.get("taskId");
    const fileEntry = formData.get("file");
    const file = fileEntry instanceof File ? fileEntry : null;

    const sourceLink = formData.get("sourceLink") as string | null;
    const uploadNote = formData.get("uploadNote") as string | null;
    const outputType = formData.get("outputType") as string | null;
    const isFinalCandidateStr = formData.get("isFinalCandidate") as string | null;
    const isFinalCandidate = isFinalCandidateStr === "false" ? false : true;

    if (typeof taskId !== "string" || !taskId) {
      return NextResponse.json(
        { error: "Task ID wajib diisi." },
        { status: 400 },
      );
    }

    const db = getAdminDb();
    const taskRef = db.collection("tasks").doc(taskId);
    const taskSnapshot = await taskRef.get();

    if (!taskSnapshot.exists) {
      return NextResponse.json(
        { error: "Task tidak ditemukan." },
        { status: 404 },
      );
    }

    const task = {
      id: taskSnapshot.id,
      ...taskSnapshot.data(),
    } as Task;

    if (!(await canUploadTaskResult(profile, task))) {
      return NextResponse.json(
        { error: "Anda tidak punya akses upload untuk task ini." },
        { status: 403 },
      );
    }

    // 4. Validasi Bukti Pengerjaan (File atau Source Link)
    const hasFile = file !== null && file.name && file.size > 0;
    
    if (file) {
      if (file.size === 0) {
        return NextResponse.json(
          { error: "File yang diunggah tidak boleh kosong (0 bytes)." },
          { status: 400 }
        );
      }
      const validation = validateFileUpload(file);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
    }

    if (!hasFile && (!sourceLink || !sourceLink.trim())) {
      return NextResponse.json(
        { error: "Bukti pengerjaan harus menyertakan file atau tautan dokumen (sourceLink)." },
        { status: 400 }
      );
    }

    const uploadCount = await taskRef.collection("uploads").count().get();
    const versionNumber = (uploadCount.data().count ?? 0) + 1;

    let uploadUrl = "";
    let thumbnailUrl = "";
    let publicId = "";
    let fileName = "";
    let fileSize = 0;
    let fileType = "";

    if (hasFile && file) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const folder = `jobdex/${task.organization_id || "main_org"}/tasks/${taskId}`;
      const cloudinaryResult = await uploadImageBuffer({
        buffer,
        folder,
        fileName: file.name,
        mimeType: file.type,
      });
      uploadUrl = cloudinaryResult.secure_url;
      const isImage = file.type.startsWith("image/");
      thumbnailUrl = isImage ? buildCloudinaryThumbnail(cloudinaryResult.public_id) : "";
      publicId = cloudinaryResult.public_id;
      fileName = file.name;
      fileSize = file.size;
      fileType = file.type;
    }

    const uploadRef = taskRef.collection("uploads").doc();
    const batch = db.batch();

    const orgId = task.org_id || task.orgId || task.organization_id || "main_org";
    const campusId = task.campus_id || task.campusId || task.univ_id || task.univId || "";

    batch.set(uploadRef, {
      id: uploadRef.id,
      task_id: taskId,
      version_number: versionNumber,
      file_url: uploadUrl || null,
      thumbnail_url: thumbnailUrl || null,
      public_id: publicId || null,
      file_name: fileName || null,
      file_size: fileSize || null,
      file_type: fileType || null,
      source_link: sourceLink ? sourceLink.trim() : null,
      source_link_type: getSourceLinkType(sourceLink || undefined) || null,
      output_type: outputType || (hasFile ? "image" : "link"),
      notes: uploadNote ? uploadNote.trim() : null,
      is_final_candidate: isFinalCandidate,
      uploaded_by: profile.id,
      uploaded_by_name: profile.name,
      uploaded_at: FieldValue.serverTimestamp(),
      organization_id: orgId,
      org_id: orgId,
      orgId: orgId,
      campus_id: campusId,
      campusId: campusId,
      univ_id: campusId,
      univId: campusId,
    });

    const isTransitionToReview = task.status !== "draft_selesai" && task.status !== "menunggu_approval";

    const taskUpdates: Record<string, unknown> = {
      result_design_url: uploadUrl || sourceLink || task.result_design_url || "",
      status: "menunggu_approval",
      approval_status: "pending",
      updated_at: FieldValue.serverTimestamp(),
    };

    if (sourceLink && sourceLink.trim()) {
      taskUpdates.source_link = sourceLink.trim();
    }

    batch.update(taskRef, taskUpdates);

    const logRef = isTransitionToReview
      ? taskRef.collection("status_logs").doc()
      : null;

    if (logRef) {
      batch.set(logRef, {
        id: logRef.id,
        task_id: taskId,
        organization_id: orgId,
        org_id: orgId,
        orgId: orgId,
        campus_id: campusId,
        campusId: campusId,
        univ_id: campusId,
        univId: campusId,
        from_status: task.status,
        to_status: "menunggu_approval",
        changed_by: profile.id,
        note: hasFile ? "Hasil pengerjaan diupload." : "Hasil pengerjaan diserahkan (tanpa file).",
        created_at: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    if (task.type === "acara" && task.event_id) {
      await recalculateEventProgressAdmin(task.event_id);
    }

    const notification = await notifyTaskEvent({
      eventType: "task_result_uploaded",
      taskId,
      actorId: profile.id,
      status: "menunggu_approval",
      note: hasFile ? "Hasil pengerjaan diupload." : "Hasil pengerjaan diserahkan (tanpa file).",
      uploadUrl,
      thumbnailUrl,
    });

    return NextResponse.json({
      ok: true,
      whatsappSent: notification.sent,
      upload: {
        id: uploadRef.id,
        upload_url: uploadUrl,
        thumbnail_url: thumbnailUrl,
        version_number: versionNumber,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Upload hasil desain gagal diproses.",
      },
      { status: 500 },
    );
  }
}
