"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { canEditWorkspace, getWorkspaceRole } from "@/lib/workspace-access";
import { prisma } from "@/lib/prisma";
import { MemberRole, WorkspaceStatus } from "@/lib/generated/prisma/enums";

// Workspaces are listed on both the dashboard (recent) and the board page.
function revalidateWorkspaceLists() {
  revalidatePath("/dashboard");
  revalidatePath("/workspaces");
}

// A workspace is always exactly one Doc + one Canvas, so both are created in the same
// transaction as the Workspace row — never left dangling without a pair.
export async function createWorkspace(name: string, description?: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");

  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Workspace name is required");

  // New workspaces land at the top of the creator's Planning column.
  const top = await prisma.workspace.findFirst({
    where: { status: "PLANNING", creatorId: user.id },
    orderBy: { position: "asc" },
    select: { position: true },
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: trimmedName,
      description: description?.trim() || null,
      creatorId: user.id,
      position: top ? top.position - 1 : 0,
      doc: { create: {} },
      canvas: { create: {} },
    },
  });

  revalidateWorkspaceLists();
  return { workspace: { id: workspace.id } };
}

// Leaving description undefined keeps it as-is (the header's inline rename only sends a name).
export async function updateWorkspace(workspaceId: string, name: string, description?: string) {
  if (!(await canEditWorkspace(workspaceId))) throw new Error("Workspace not found");

  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Workspace name is required");

  const workspace = await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      name: trimmedName,
      ...(description !== undefined && { description: description.trim() || null }),
    },
  });

  revalidateWorkspaceLists();
  revalidatePath(`/workspace/${workspaceId}`);
  return workspace;
}

// Only the creator can delete a workspace.
export async function deleteWorkspace(workspaceId: string) {
  if ((await getWorkspaceRole(workspaceId)) !== "OWNER") {
    throw new Error("Only the creator can delete this workspace");
  }

  // Doc, canvas and members cascade-delete with the workspace; agent prompt rows stay.
  await prisma.workspace.delete({ where: { id: workspaceId } });
  revalidateWorkspaceLists();
}

// Called after a board drag — the client has already moved the card, so no revalidatePath.
export async function moveWorkspace(workspaceId: string, status: WorkspaceStatus, position: number) {
  if (!Object.values(WorkspaceStatus).includes(status) || !Number.isFinite(position)) {
    throw new Error("Invalid move");
  }
  if (!(await canEditWorkspace(workspaceId))) throw new Error("Workspace not found");

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { status, position },
  });
}

// Turning sharing on creates a fresh token, so re-enabling never revives an old link.
// Resetting is the same as turning it on again: the previous link stops working.
export async function setWorkspaceSharing(workspaceId: string, enabled: boolean) {
  if (!(await canEditWorkspace(workspaceId))) throw new Error("Workspace not found");

  const { shareToken } = await prisma.workspace.update({
    where: { id: workspaceId },
    data: { shareToken: enabled ? randomBytes(24).toString("base64url") : null },
    select: { shareToken: true },
  });

  revalidatePath(`/workspace/${workspaceId}`);
  return { shareToken };
}

// ---------- Members ----------

export type WorkspaceMemberView = {
  userId: string;
  email: string;
  name: string | null;
  imageUrl: string | null;
  role: MemberRole;
};

// The creator invites a teammate by email. They must have signed in once, so their User row
// exists. Errors are returned, not thrown, since Next hides thrown messages in production.
export async function inviteMember(
  workspaceId: string,
  email: string,
  role: MemberRole
): Promise<{ member: WorkspaceMemberView } | { error: string }> {
  if ((await getWorkspaceRole(workspaceId)) !== "OWNER") return { error: "Only the creator can invite people" };
  if (!Object.values(MemberRole).includes(role)) return { error: "Invalid role" };

  const invitee = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!invitee) return { error: "No Outpost account with that email. Ask them to sign in once first." };

  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { creatorId: true } });
  if (invitee.id === workspace.creatorId) return { error: "That's you, you already own this workspace" };

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId, userId: invitee.id } },
    update: { role },
    create: { workspaceId, userId: invitee.id, role },
  });

  revalidatePath(`/workspace/${workspaceId}`);
  return {
    member: { userId: invitee.id, email: invitee.email, name: invitee.name, imageUrl: invitee.imageUrl, role },
  };
}

export async function removeMember(workspaceId: string, userId: string) {
  if ((await getWorkspaceRole(workspaceId)) !== "OWNER") throw new Error("Only the creator can remove people");

  await prisma.workspaceMember.deleteMany({ where: { workspaceId, userId } });
  revalidatePath(`/workspace/${workspaceId}`);
}
