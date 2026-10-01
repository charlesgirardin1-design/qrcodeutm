import { NextResponse } from "next/server";
import { withAuth, readJson, ApiError } from "@/lib/api";
import { hasPermission } from "@/lib/auth/roles";
import { bulkSchema } from "@/lib/validations";
import { deleteManyMedia, setMediaStatus } from "@/lib/media/service";

export const maxDuration = 300;

/** Actions groupées (ADMIN) : changement de statut ou suppression définitive. */
export const POST = withAuth("media:update", async (request, { session }) => {
  const input = bulkSchema.parse(await readJson(request));

  if (input.action === "set-status") {
    const updated = await setMediaStatus(input.ids, input.status, session);
    return NextResponse.json({ updated });
  }

  if (!hasPermission(session.role, "media:delete")) throw new ApiError(403, "Accès refusé.");
  const result = await deleteManyMedia(input.ids, session);
  return NextResponse.json(result, { status: result.failed.length && !result.deleted.length ? 500 : 200 });
});
