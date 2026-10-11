"use client";

import { useId, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronsUpDownIcon, FileTextIcon, Loader2Icon, PlusIcon, XIcon } from "lucide-react";
import { saveSpace } from "@/app/actions/spaces";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { documentsQuery } from "@/lib/queries";
import { ACCEPTED_TYPES, MAX_SPACE_INSTRUCTIONS } from "@/lib/schemas";
import type { DocumentItem, Space } from "@/lib/types";
import { cn } from "@/lib/utils";
import { KIND } from "./library-view";
import { uploadFile } from "./upload-form";

const ACCEPT = Object.values(ACCEPTED_TYPES).join(",");

/* Creates a space, or edits one, with everything saved together by one button.
   Without `space`, it creates; `onSaved` gets the space's id either way. */
export function SpaceDialog({
  open,
  onOpenChange,
  space,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  space?: Space;
  onSaved?: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass flex max-h-[90dvh] flex-col gap-0 border border-glass-border bg-glass-strong p-0 sm:max-w-lg">
        {/* Remounted on each open, so the fields start from the saved space */}
        {open && <SpaceForm space={space} onDone={(id) => (onOpenChange(false), onSaved?.(id))} />}
      </DialogContent>
    </Dialog>
  );
}

function SpaceForm({ space, onDone }: { space?: Space; onDone: (id: string) => void }) {
  const queryClient = useQueryClient();
  const library = useQuery(documentsQuery).data ?? [];
  const [name, setName] = useState(space?.name ?? "");
  const [instructions, setInstructions] = useState(space?.instructions ?? "");
  const [picked, setPicked] = useState<Set<string>>(new Set(space?.documentIds));
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Unique ids: the page behind can have its own "Instructions" heading
  const uid = useId();

  const upload = useMutation({
    // Stays pending until the library has the new file, so it shows in the list as it's selected
    mutationFn: async (file: File) => {
      const result = await uploadFile(file);
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      return result;
    },
    onSuccess: ({ id }) => setPicked((p) => new Set(p).add(id)),
  });

  const save = useMutation({
    mutationFn: () =>
      saveSpace({ id: space?.id, name, instructions, documentIds: [...picked] }),
    onSuccess: (result) => {
      if (result.id) {
        queryClient.invalidateQueries({ queryKey: ["spaces"] });
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      }
      if (result.ok && result.id) onDone(result.id);
    },
  });
  const error = save.data && !save.data.ok
    ? (save.data.fieldErrors ? Object.values(save.data.fieldErrors).flat()[0] : save.data.message)
    : undefined;

  function toggle(id: string) {
    setPicked((p) => {
      const next = new Set(p);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }
  const chosen = library.filter((d) => picked.has(d.id));

  return (
    <form
      className="flex min-h-0 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <DialogHeader className="border-b border-glass-divider p-5">
        <DialogTitle>{space ? "Edit space" : "New space"}</DialogTitle>
        <DialogDescription>Chats in a space answer only from the documents you pick.</DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
        <div className="space-y-2">
          <Label htmlFor={`${uid}-name`}>Name</Label>
          <Input
            id={`${uid}-name`}
            value={name}
            maxLength={80}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            placeholder="For example: Biology finals"
            className="h-10 rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${uid}-docs`}>Documents</Label>
          <div className="flex gap-2">
            {/* Search the library and tick documents; the list stays open for picking several */}
            <Popover modal open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  id={`${uid}-docs`}
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={pickerOpen}
                  className="h-10 min-w-0 flex-1 justify-between rounded-xl px-3 font-normal"
                >
                  <span className={cn("truncate", picked.size === 0 && "text-muted-foreground")}>
                    {picked.size === 0
                      ? "Choose from your library"
                      : `${picked.size} ${picked.size === 1 ? "document" : "documents"} selected`}
                  </span>
                  <ChevronsUpDownIcon className="text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-(--radix-popover-trigger-width) rounded-xl p-0">
                <Command>
                  <CommandInput placeholder="Search documents" />
                  <CommandList>
                    <CommandEmpty>{library.length ? "No documents match." : "Your library is empty."}</CommandEmpty>
                    <CommandGroup>
                      {library.map((doc) => (
                        <CommandItem
                          key={doc.id}
                          value={doc.id}
                          keywords={[doc.filename]}
                          data-checked={picked.has(doc.id)}
                          onSelect={() => toggle(doc.id)}
                        >
                          <KindIcon doc={doc} className="size-6 rounded-md [&_svg]:size-3.5" />
                          <span className="min-w-0 flex-1 truncate">{doc.filename}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Button
              type="button"
              variant="glass"
              className="h-10 rounded-xl"
              disabled={upload.isPending}
              onClick={() => fileRef.current?.click()}
            >
              <PlusIcon />
              {upload.isPending ? "Uploading…" : "Upload"}
            </Button>
          </div>

          {chosen.length > 0 && (
            <ul aria-label="Selected documents" className="max-h-48 divide-y divide-glass-divider overflow-y-auto rounded-xl border border-glass-border bg-glass">
              {chosen.map((doc) => (
                <li key={doc.id} className="flex items-center gap-3 py-2 pr-2 pl-3">
                  <KindIcon doc={doc} />
                  <span className="min-w-0 flex-1 truncate text-sm">{doc.filename}</span>
                  {(doc.status === "pending" || doc.status === "processing") && (
                    <Loader2Icon aria-label="Indexing" className="size-4 shrink-0 animate-spin text-muted-foreground" />
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${doc.filename}`}
                    onClick={() => toggle(doc.id)}
                    className="text-muted-foreground"
                  >
                    <XIcon />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (file) upload.mutate(file);
              e.currentTarget.value = "";
            }}
          />
          {upload.isError && (
            <p role="alert" className="text-sm text-destructive">
              {upload.error.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <Label htmlFor={`${uid}-instructions`}>
              Instructions <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <span className="text-xs text-muted-foreground tabular-nums">
              {instructions.length} / {MAX_SPACE_INSTRUCTIONS}
            </span>
          </div>
          <Textarea
            id={`${uid}-instructions`}
            value={instructions}
            maxLength={MAX_SPACE_INSTRUCTIONS}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="How answers should read. For example: Explain like a patient tutor and end with a quick quiz question."
            className="min-h-24 rounded-xl px-3 py-2.5"
          />
        </div>
      </div>

      <DialogFooter className="m-0 flex-row items-center border-t border-glass-divider bg-transparent p-4">
        <span role="status" className="mr-auto text-sm text-destructive">
          {error}
        </span>
        <Button type="submit" disabled={!name.trim() || save.isPending || upload.isPending}>
          {save.isPending ? "Saving…" : space ? "Save" : "Create space"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function KindIcon({ doc, className }: { doc: DocumentItem; className?: string }) {
  const kind = KIND[doc.mimeType] ?? { label: "File", color: "bg-[#8e8e93]" };
  return (
    <span className={cn("grid size-7 shrink-0 place-items-center rounded-md text-white", kind.color, className)}>
      <FileTextIcon className="size-4" />
    </span>
  );
}
