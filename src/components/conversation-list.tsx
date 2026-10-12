"use client";

import { useState } from "react";
import Link from "next/link";
import { Reorder, useDragControls } from "motion/react";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  CheckIcon,
  GripVerticalIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  Trash2Icon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import type { ConversationSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { sortConversations, useChatSort, usePinConversation, useReorderConversations } from "./conversation-actions";

type Props = {
  conversations: ConversationSummary[] | undefined;
  isPending: boolean;
  pathname: string;
  /** Closes the sidebar on phones after following a link. */
  close: () => void;
  onRename: (c: ConversationSummary) => void;
  onDelete: (c: ConversationSummary) => void;
  /** Whether an item was added during this visit (it slides in). */
  fresh: (id: string) => boolean;
};

/*
 * The sidebar's conversations: pinned ones, then the rest, newest first or in your own order. In your
 * own order they can be dragged by the handle, or moved from their menu.
 */
export function ConversationGroups({ conversations, isPending, pathname, close, onRename, onDelete, fresh }: Props) {
  const [sort, setSort] = useChatSort();
  const pin = usePinConversation();
  const reorder = useReorderConversations();

  const pinned = sortConversations((conversations ?? []).filter((c) => c.pinned), "updated");
  const rest = sortConversations((conversations ?? []).filter((c) => !c.pinned), sort);
  const manual = sort === "manual";

  // While dragging, the list follows the pointer; the order is saved on drop
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  const byId = new Map(rest.map((c) => [c.id, c]));
  const ordered = (dragOrder ?? rest.map((c) => c.id)).map((id) => byId.get(id)).filter((c): c is ConversationSummary => !!c);
  const ids = ordered.map((c) => c.id);
  const move = (id: string, by: -1 | 1) => {
    const i = ids.indexOf(id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= ids.length) return;
    const next = [...ids];
    [next[i], next[j]] = [next[j], next[i]];
    reorder.mutate(next);
  };

  const row = (c: ConversationSummary, extra?: { index: number; count: number }) => (
    <Row
      key={c.id}
      c={c}
      active={pathname === `/chat/${c.id}`}
      close={close}
      draggable={manual && !c.pinned}
      menu={
        <>
          <DropdownMenuItem onSelect={() => onRename(c)}>
            <PencilIcon />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => pin.mutate({ id: c.id, pinned: !c.pinned })}>
            {c.pinned ? <PinOffIcon /> : <PinIcon />}
            {c.pinned ? "Unpin" : "Pin"}
          </DropdownMenuItem>
          {manual && extra && (
            <>
              <DropdownMenuItem disabled={extra.index === 0} onSelect={() => move(c.id, -1)}>
                <ArrowUpIcon />
                Move up
              </DropdownMenuItem>
              <DropdownMenuItem disabled={extra.index === extra.count - 1} onSelect={() => move(c.id, 1)}>
                <ArrowDownIcon />
                Move down
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => onDelete(c)}>
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </>
      }
      className={cn(fresh(c.id) && "animate-in fade-in slide-in-from-left-2 duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none")}
    />
  );

  return (
    <>
      <>
          {pinned.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel>Pinned</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>{pinned.map((c) => row(c))}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          <SidebarGroup>
            <SidebarGroupLabel>Conversations</SidebarGroupLabel>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarGroupAction aria-label="Sort conversations" title="Sort">
                  <ArrowUpDownIcon />
                </SidebarGroupAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" className="w-auto min-w-48">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Sort by</DropdownMenuLabel>
                {(
                  [
                    ["updated", "Last updated"],
                    ["manual", "Your order"],
                  ] as const
                ).map(([value, label]) => (
                  <DropdownMenuItem key={value} onSelect={() => setSort(value)} className="gap-2.5">
                    <CheckIcon className={cn(sort !== value && "invisible")} />
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <SidebarGroupContent>
              {isPending && (
                <SidebarMenu>
                  {[0, 1, 2].map((i) => (
                    <SidebarMenuItem key={i}>
                      <SidebarMenuSkeleton />
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              )}
              {conversations?.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">No conversations yet</p>}
              {manual ? (
                <Reorder.Group
                  as="ul"
                  axis="y"
                  values={ids}
                  onReorder={setDragOrder}
                  data-slot="sidebar-menu"
                  data-sidebar="menu"
                  className="flex w-full min-w-0 flex-col gap-0.5"
                >
                  {ordered.map((c, index) => (
                    <DraggableItem
                      key={c.id}
                      id={c.id}
                      onDrop={() => {
                        if (dragOrder && dragOrder.join() !== rest.map((r) => r.id).join()) reorder.mutate(dragOrder);
                        setDragOrder(null);
                      }}
                    >
                      {(handle) => (
                        <>
                          {handle}
                          {row(c, { index, count: ordered.length })}
                        </>
                      )}
                    </DraggableItem>
                  ))}
                </Reorder.Group>
              ) : (
                <SidebarMenu>{ordered.map((c) => row(c))}</SidebarMenu>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
      </>
    </>
  );
}

/** One conversation in the sidebar: its link and its menu. */
function Row({
  c,
  active,
  close,
  draggable,
  menu,
  className,
}: {
  c: ConversationSummary;
  active: boolean;
  close: () => void;
  draggable: boolean;
  menu: React.ReactNode;
  className?: string;
}) {
  const Item = draggable ? "div" : SidebarMenuItem;
  return (
    <Item className={cn("group/menu-item relative", className)}>
      <SidebarMenuButton asChild isActive={active} className={cn(draggable && "pl-6")}>
        <Link href={`/chat/${c.id}`} onClick={close}>
          {c.pinned && <PinIcon className="text-primary" />}
          <span>{c.title}</span>
        </Link>
      </SidebarMenuButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction showOnHover aria-label={`More options for ${c.title}`}>
            <MoreHorizontalIcon />
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-auto min-w-44">
          {menu}
        </DropdownMenuContent>
      </DropdownMenu>
    </Item>
  );
}

/** A list item that can be dragged by its handle. */
function DraggableItem({ id, onDrop, children }: { id: string; onDrop: () => void; children: (handle: React.ReactNode) => React.ReactNode }) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      as="li"
      value={id}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDrop}
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className="group/drag relative rounded-md"
      whileDrag={{ scale: 1.02, boxShadow: "0 8px 24px -8px rgb(1 40 110 / 0.3)", zIndex: 10 }}
    >
      {children(
        <button
          type="button"
          aria-label="Drag to reorder"
          onPointerDown={(e) => {
            e.preventDefault();
            controls.start(e);
          }}
          className="absolute top-1/2 left-0.5 z-10 grid h-6 w-5 -translate-y-1/2 cursor-grab touch-none place-items-center rounded text-muted-foreground/60 opacity-0 transition-opacity group-hover/drag:opacity-100 hover:text-foreground focus-visible:opacity-100 active:cursor-grabbing max-md:opacity-100"
        >
          <GripVerticalIcon className="size-3.5" />
        </button>
      )}
    </Reorder.Item>
  );
}
