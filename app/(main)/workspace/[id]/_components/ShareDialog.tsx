"use client";

import { useState, useSyncExternalStore } from "react";
import { Copy, FileText, LayoutGrid, RotateCcw, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { inviteMember, removeMember, setWorkspaceSharing, type WorkspaceMemberView } from "@/actions/workspace";
import { useFetch } from "@/hooks/use-fetch";
import { useWorkspaceEditors } from "@/components/WorkspaceEditorsContext";
import { Avatar } from "@/components/SiteHeader";
import type { WorkspaceRole } from "@/lib/workspace-access";
import type { MemberRole } from "@/lib/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// window only exists in the browser, so read the site origin through React's external-store API,
// which renders "" on the server and the real origin once hydrated.
const noopSubscribe = () => () => {};
const getOrigin = () => window.location.origin;
const getServerOrigin = () => "";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

type Person = { email: string; name: string | null; imageUrl: string | null };

export function ShareDialog({
  workspaceId,
  workspaceName,
  initialShareToken,
  role,
  owner,
  initialMembers,
}: {
  workspaceId: string;
  workspaceName: string;
  initialShareToken: string | null;
  // The viewer's own role: only the OWNER invites/removes people; VIEWERs can't change sharing.
  role: WorkspaceRole;
  owner: Person;
  initialMembers: WorkspaceMemberView[];
}) {
  const [open, setOpen] = useState(false);
  const [shareToken, setShareToken] = useState(initialShareToken);
  const [exporting, setExporting] = useState<"doc" | "canvas" | null>(null);
  const [members, setMembers] = useState(initialMembers);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("EDITOR");
  const { canvasEditor, docEditor } = useWorkspaceEditors();
  const { fn: setSharingFn, loading } = useFetch(setWorkspaceSharing);
  const { fn: inviteFn, loading: inviting } = useFetch(inviteMember);
  const { fn: removeFn } = useFetch(removeMember);
  const origin = useSyncExternalStore(noopSubscribe, getOrigin, getServerOrigin);
  const shareUrl = `${origin}/shared/${shareToken}`;
  const isOwner = role === "OWNER";
  const canEdit = role !== "VIEWER";

  const updateSharing = async (enabled: boolean) => {
    const result = await setSharingFn(workspaceId, enabled);
    if (result) setShareToken(result.shareToken);
  };

  const invite = async () => {
    const email = inviteEmail.trim();
    if (!email) return;
    const result = await inviteFn(workspaceId, email, inviteRole);
    if (!result) return;
    if ("error" in result) return toast.error(result.error);
    // Inviting someone again just updates their role.
    setMembers((prev) => [...prev.filter((m) => m.userId !== result.member.userId), result.member]);
    setInviteEmail("");
    toast.success(`${result.member.name ?? result.member.email} can now open this workspace`);
  };

  const remove = async (userId: string) => {
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
    await removeFn(workspaceId, userId);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied");
  };

  // BlockNote's own exporter builds a real text PDF from the live doc. Both libraries are
  // loaded only on click, since they're too big to ship with the page.
  const exportDoc = async () => {
    if (!docEditor) return;
    setExporting("doc");
    try {
      const [{ PDFExporter, pdfDefaultSchemaMappings }, { pdf }] = await Promise.all([
        import("@blocknote/xl-pdf-exporter/react-pdf"),
        import("@react-pdf/renderer"),
      ]);
      const exporter = new PDFExporter(docEditor.schema, pdfDefaultSchemaMappings);
      const pdfDocument = await exporter.toReactPDFDocument(docEditor.document);
      downloadBlob(await pdf(pdfDocument).toBlob(), `${workspaceName} - doc.pdf`);
    } catch {
      toast.error("Couldn't export the doc");
    } finally {
      setExporting(null);
    }
  };

  // Renders the canvas to a high-res PNG, then wraps it in a single PDF page of the same size.
  const exportCanvas = async () => {
    if (!canvasEditor) return;
    const shapeIds = [...canvasEditor.getCurrentPageShapeIds()];
    if (shapeIds.length === 0) {
      toast.error("The canvas is empty");
      return;
    }

    setExporting("canvas");
    try {
      const { url, width, height } = await canvasEditor.toImageDataUrl(shapeIds, {
        format: "png",
        background: true,
        padding: 32,
        scale: 2,
      });
      const { jsPDF } = await import("jspdf");
      // Page size is half the image's pixels, so the 2x render stays crisp when zoomed.
      const [pageWidth, pageHeight] = [width / 2, height / 2];
      const pdf = new jsPDF({
        orientation: pageWidth > pageHeight ? "landscape" : "portrait",
        unit: "px",
        format: [pageWidth, pageHeight],
        hotfixes: ["px_scaling"],
      });
      pdf.addImage(url, "PNG", 0, 0, pageWidth, pageHeight);
      pdf.save(`${workspaceName} - canvas.pdf`);
    } catch {
      toast.error("Couldn't export the canvas");
    } finally {
      setExporting(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Share2 className="size-4" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share &ldquo;{workspaceName}&rdquo;</DialogTitle>
          <DialogDescription>
            The creator and invited teammates can open this workspace.
          </DialogDescription>
        </DialogHeader>

        {/* People with access: the creator, then invited members. */}
        <div className="space-y-3">
          <Label>People</Label>
          {isOwner && (
            <div className="flex items-center gap-2">
              <Input
                type="email"
                placeholder="teammate@gmail.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && invite()}
                className="text-sm"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as MemberRole)}
                aria-label="Role"
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
              >
                <option value="EDITOR">Editor</option>
                <option value="VIEWER">Viewer</option>
              </select>
              <Button onClick={invite} disabled={!inviteEmail.trim() || (inviting ?? false)}>
                Invite
              </Button>
            </div>
          )}
          <ul className="max-h-48 space-y-2 overflow-y-auto">
            <PersonRow person={owner} label="Owner" />
            {members.map((member) => (
              <PersonRow
                key={member.userId}
                person={member}
                label={member.role === "EDITOR" ? "Editor" : "Viewer"}
                onRemove={isOwner ? () => remove(member.userId) : undefined}
              />
            ))}
          </ul>
          {isOwner && (
            <p className="text-xs text-muted-foreground">Teammates need to sign in to Outpost once before you can invite them.</p>
          )}
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="share-link" className="flex flex-col items-start gap-1">
              <span>Public link</span>
              <span className="text-xs font-normal text-muted-foreground">
                Anyone with the link can view the doc and canvas, without signing in.
              </span>
            </Label>
            <Switch
              id="share-link"
              checked={shareToken !== null}
              onCheckedChange={updateSharing}
              disabled={!canEdit || (loading ?? false)}
            />
          </div>

          {shareToken && (
            <div className="flex items-center gap-2">
              <Input readOnly value={shareUrl} className="text-xs" />
              <Button variant="outline" size="icon" onClick={copyLink} aria-label="Copy link">
                <Copy className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => updateSharing(true)}
                disabled={!canEdit || (loading ?? false)}
                aria-label="Reset link"
                title="Reset link (the old link stops working)"
              >
                <RotateCcw className="size-4" />
              </Button>
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-3">
          <Label>Export as PDF</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={exportDoc}
              disabled={!docEditor || exporting !== null}
            >
              <FileText className="size-4" />
              {exporting === "doc" ? "Exporting..." : "Doc"}
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={exportCanvas}
              disabled={!canvasEditor || exporting !== null}
            >
              <LayoutGrid className="size-4" />
              {exporting === "canvas" ? "Exporting..." : "Canvas"}
            </Button>
          </div>
          {(!docEditor || !canvasEditor) && (
            <p className="text-xs text-muted-foreground">
              Switch to the Both view to export {!docEditor ? "the doc" : "the canvas"}.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PersonRow({ person, label, onRemove }: { person: Person; label: string; onRemove?: () => void }) {
  return (
    <li className="flex items-center gap-3">
      <Avatar name={person.name ?? person.email} photoURL={person.imageUrl} size={28} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{person.name ?? person.email}</p>
        {person.name && <p className="truncate text-xs text-muted-foreground">{person.email}</p>}
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
      {onRemove && (
        <Button variant="ghost" size="icon" className="size-7" onClick={onRemove} aria-label={`Remove ${person.email}`}>
          <X className="size-3.5" />
        </Button>
      )}
    </li>
  );
}
