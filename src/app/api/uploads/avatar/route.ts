import { NextResponse, type NextRequest } from "next/server";
import { getServerAuthContext } from "@/lib/server/auth";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { uploadImageBuffer, validateCloudinaryConfig } from "@/lib/server/cloudinary";

export const runtime = "nodejs";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(request: NextRequest) {
  // 1. Validasi Kredensial Cloudinary di awal (mencegah silent crash)
  const cldConfig = validateCloudinaryConfig();
  if (!cldConfig.valid) {
    console.error("[api/uploads/avatar] Kredensial Cloudinary belum lengkap:", cldConfig.error);
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
    const msg = authError instanceof Error ? authError.message : "Autentikasi gagal.";
    return NextResponse.json(
      { error: msg },
      { status: 401 }
    );
  }

  // 3. Parsing Form-Data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (formError) {
    console.warn("[api/uploads/avatar] Gagal parse form-data:", formError);
    return NextResponse.json(
      { error: "Gagal memproses form-data. Pastikan request dikirim sebagai multipart/form-data yang valid." },
      { status: 400 }
    );
  }

  const fileEntry = formData.get("file");
  if (!fileEntry || typeof fileEntry === "string") {
    return NextResponse.json(
      { error: "File avatar tidak ditemukan dalam form data (field 'file' wajib diisi)." },
      { status: 400 }
    );
  }

  const file = fileEntry as File;

  // 4. Validasi Format & Ukuran Berkas
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Format file tidak didukung. Gunakan format JPEG, PNG, atau WebP." },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Ukuran file terlalu besar. Maksimal 5 MB." },
      { status: 400 }
    );
  }

  // 5. Ubah File menjadi Buffer dan Upload ke Cloudinary
  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadResult = await uploadImageBuffer({
      buffer,
      folder: "jobdex-avatars",
      fileName: `avatar_${profile.id}_${Date.now()}`,
      mimeType: file.type,
    });

    const avatarUrl: string = uploadResult.secure_url;

    // 6. Simpan URL avatar ke dokumen user Firestore
    try {
      const db = getAdminDb();
      await db.collection("users").doc(profile.id).update({
        avatar_url: avatarUrl,
        updated_at: new Date(),
      });
    } catch (dbErr) {
      console.warn("[api/uploads/avatar] Gagal update Firestore, return avatar_url tetap berhasil:", dbErr);
    }

    return NextResponse.json({
      ok: true,
      avatar_url: avatarUrl,
    });
  } catch (uploadError) {
    console.error("[api/uploads/avatar] Error upload Cloudinary:", uploadError);
    return NextResponse.json(
      {
        error:
          uploadError instanceof Error
            ? uploadError.message
            : "Gagal mengupload avatar ke Cloudinary.",
      },
      { status: 500 }
    );
  }
}
