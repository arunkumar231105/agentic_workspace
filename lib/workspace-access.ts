import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type WorkspaceRole = "OWNER" | "EDITOR" | "VIEWER";

// The signed-in user's role in a workspace: OWNER (its creator), EDITOR or VIEWER (invited
// members), or null if they have no access (or aren't signed in).
export async function getWorkspaceRole(workspaceId: string): Promise<WorkspaceRole | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { creatorId: true, members: { where: { userId: user.id }, select: { role: true } } },
  });
  if (!workspace) return null;
  if (workspace.creatorId === user.id) return "OWNER";
  return workspace.members[0]?.role ?? null;
}

// Anyone with a role can open the workspace.
export async function canAccessWorkspace(workspaceId: string) {
  return (await getWorkspaceRole(workspaceId)) !== null;
}

// Owners and editors can change it; viewers are read-only.
export async function canEditWorkspace(workspaceId: string) {
  const role = await getWorkspaceRole(workspaceId);
  return role === "OWNER" || role === "EDITOR";
}
