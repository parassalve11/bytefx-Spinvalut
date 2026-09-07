import { redirect } from "next/navigation";

import DrawWorkspace from "@/components/draw/DrawWorkspace";
import { getSession } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function DrawPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // The cookie gets the IB as far as the page. Every request the page then
  // makes re-verifies IB access with ByteFX before returning any client data,
  // so a revoked account loses access on its next action rather than at its
  // next sign-in.
  return <DrawWorkspace profile={{ name: session.profile.name, reference: session.profile.id }} />;
}
