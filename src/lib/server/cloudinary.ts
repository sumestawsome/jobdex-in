import "server-only";

import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

let configured = false;

export function validateCloudinaryConfig(): { valid: boolean; error?: string } {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    return { valid: false, error: "CLOUDINARY_CLOUD_NAME belum dikonfigurasi di environment." };
  }
  if (!process.env.CLOUDINARY_API_KEY) {
    return { valid: false, error: "CLOUDINARY_API_KEY belum dikonfigurasi di environment." };
  }
  if (!process.env.CLOUDINARY_API_SECRET) {
    return { valid: false, error: "CLOUDINARY_API_SECRET belum dikonfigurasi di environment." };
  }
  return { valid: true };
}

export function isCloudinaryConfigured(): boolean {
  return validateCloudinaryConfig().valid;
}

function getCloudinary() {
  const check = validateCloudinaryConfig();
  if (!check.valid) {
    throw new Error(check.error || "Konfigurasi Cloudinary tidak lengkap.");
  }

  if (!configured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }

  return cloudinary;
}

export async function uploadImageBuffer({
  buffer,
  folder,
  fileName,
  mimeType,
}: {
  buffer: Buffer;
  folder: string;
  fileName: string;
  mimeType?: string;
}): Promise<UploadApiResponse> {
  const cld = getCloudinary();

  // Mode 1: Data URI upload (sangat stabil untuk serverless Node.js, menghindari stream timeout)
  const mime = mimeType || "image/png";
  const dataUri = `data:${mime};base64,${buffer.toString("base64")}`;

  try {
    const result = await cld.uploader.upload(dataUri, {
      folder,
      resource_type: "auto",
      use_filename: true,
      filename_override: fileName,
      unique_filename: true,
    });
    return result;
  } catch (dataUriError) {
    // Mode 2 Fallback: upload_stream jika payload Data URI melebihi limit tertentu
    return new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cld.uploader.upload_stream(
        {
          folder,
          resource_type: "auto",
          use_filename: true,
          filename_override: fileName,
          unique_filename: true,
        },
        (error, result) => {
          if (error || !result) {
            reject(error ?? dataUriError ?? new Error("Upload Cloudinary gagal."));
            return;
          }
          resolve(result);
        }
      );

      stream.on("error", (err) => {
        reject(err);
      });

      stream.end(buffer);
    });
  }
}

export function buildCloudinaryThumbnail(publicId: string) {
  return getCloudinary().url(publicId, {
    width: 500,
    crop: "limit",
    fetch_format: "auto",
    quality: "auto",
    secure: true,
  });
}
