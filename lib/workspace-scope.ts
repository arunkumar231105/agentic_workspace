import type { Prisma } from "@/lib/generated/prisma/client";

// What the dashboard and the board list: workspaces the user created or was invited to.
export function workspacesForUser(userId: string): Prisma.WorkspaceWhereInput {
  return { OR: [{ creatorId: userId }, { members: { some: { userId } } }] };
}
