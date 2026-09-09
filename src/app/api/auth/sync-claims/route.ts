import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { getServerAuthContext, syncUserClaims, setUserCustomClaims } from "@/lib/server/auth";
import type { UserRole } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const authContext = await getServerAuthContext(request);
    const body = await request.json().catch(() => ({}));
    const targetUid = (body?.target_uid as string) || authContext.uid;

    // Jika targetUid berbeda dengan caller, pastikan caller adalah super_admin
    if (targetUid !== authContext.uid && authContext.role !== "super_admin") {
      return NextResponse.json(
        { error: "Hanya super admin yang dapat memperbarui klaim pengguna lain." },
        { status: 403 },
      );
    }

    // Jika admin mengirim role/organisasi langsung untuk dirotasi/diupdate
    if (body?.role && authContext.role === "super_admin") {
      await setUserCustomClaims(targetUid, {
        role: body.role as UserRole,
        org_id: body.org_id,
        univ_id: body.univ_id,
        division_id: body.division_id,
      });

      return NextResponse.json({
        success: true,
        claims: {
          role: body.role,
          org_id: body.org_id,
          univ_id: body.univ_id,
          division_id: body.division_id,
        },
      });
    }

    const updatedClaims = await syncUserClaims(targetUid);

    return NextResponse.json({
      success: true,
      claims: updatedClaims,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menyinkronkan klaim pengguna.";
    const status = message.includes("Token") ? 401 : message.includes("dinonaktifkan") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
