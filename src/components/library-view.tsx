"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpIcon, FilePlusIcon, FileTextIcon, MoreHorizontalIcon, PencilIcon, RotateCcwIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { deleteDocument, retryDocument } from "@/app/actions/documents";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { documentsQuery } from "@/lib/queries";
import type { DocumentItem } from "@/lib/types";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";
import { UploadForm } from "./upload-form";

export const KIND: Record<string, { label: string; color: string }> = {
  "text/markdown": { label: "Markdown", color: "bg-[#8e8e93]" },
  "application/pdf": { label: "PDF", color: "bg-[#ff3b30]" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { label: "Word", color: "bg-[#0152cb]" },
};
const kindOf = (doc: DocumentItem) => KIND[doc.mimeType] ?? { label: "File", color: "bg-[#8e8e93]" };

export function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const PAGE_SIZE = 10;
const ALL_TYPES = "all";

// A header that sorts its column, showing the current direction
function SortHeader({ column, children }: { column: import("@tanstack/react-table").Column<DocumentItem>; children: React.ReactNode }) {
  const sorted = column.getIsSorted();
  return (
    <Button variant="ghost" size="sm" className="-ml-2.5 font-medium text-muted-foreground" onClick={() => column.toggleSorting(sorted === "asc")}>
      {children}
      {sorted === "asc" ? <ArrowUpIcon /> : sorted === "desc" ? <ArrowDownIcon /> : null}
    </Button>
  );
}

const columns: ColumnDef<DocumentItem>[] = [
  {
    accessorKey: "filename",
    header: ({ column }) => <SortHeader column={column}>Name</SortHeader>,
    cell: ({ row }) => <NameCell doc={row.original} />,
    // Takes the leftover width, so long names truncate instead of widening the table
    meta: { className: "w-full max-w-0" },
  },
  {
    id: "type",
    accessorFn: (doc) => doc.mimeType,
    header: "Type",
    filterFn: "equals",
    cell: ({ row }) => kindOf(row.original).label,
    meta: { className: "hidden xl:table-cell whitespace-nowrap" },
  },
  {
    accessorKey: "sizeBytes",
    header: ({ column }) => <SortHeader column={column}>Size</SortHeader>,
    cell: ({ row }) => <span className="tabular-nums">{formatSize(row.original.sizeBytes)}</span>,
    meta: { className: "hidden xl:table-cell whitespace-nowrap" },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => <SortHeader column={column}>Added</SortHeader>,
    cell: ({ row }) => dateFormat.format(new Date(row.original.createdAt)),
    meta: { className: "hidden lg:table-cell whitespace-nowrap" },
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => <Status doc={row.original} />,
    // On phones, status moves under the name to leave room for it
    meta: { className: "hidden sm:table-cell" },
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <RowActions doc={row.original} />,
    meta: { className: "w-0" },
  },
];

const metaClass = (meta: unknown) => (meta as { className?: string } | undefined)?.className;

export function LibraryView() {
  const query = useQuery(documentsQuery);
  const hydrated = useHydrated();
  const documents = hydrated ? query.data : undefined;
  const isPending = !hydrated || query.isPending;
  const error = hydrated ? query.error : null;

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: PAGE_SIZE });

  // TanStack Table can't be memoized by the React Compiler, so it skips this component
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: documents ?? [],
    columns,
    getRowId: (doc) => doc.id,
    state: { sorting, columnFilters, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    // Keep the page when the list refreshes while files index
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const search = (table.getColumn("filename")?.getFilterValue() as string) ?? "";
  const type = (table.getColumn("type")?.getFilterValue() as string) ?? ALL_TYPES;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize } = table.getState().pagination;
  const types = [...new Set(documents?.map((d) => d.mimeType))];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-12 pt-14 pb-24">
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-2 gap-y-3">
          <h1 className="text-3xl font-bold tracking-tight">Library</h1>
          <Button asChild variant="glass">
            <Link href="/library/new">
              <FilePlusIcon />
              New
            </Link>
          </Button>
          <UploadForm />
        </div>
        <p className="mt-2 text-muted-foreground">
          Markdown, PDF, and Word files. Drop a file anywhere on this page to upload it, or write a new
          one in Markdown.
        </p>

        <section aria-label="Documents" className="mt-10">
          {error && <p className="text-destructive">Couldn&apos;t load your documents. Refresh to try again.</p>}

          {isPending && (
            <div className="glass overflow-hidden rounded-xl border border-glass-border bg-glass" aria-label="Loading documents">
              <Table>
                <TableBody>
                  {[0, 1, 2].map((i) => (
                    <TableRow key={i} className="border-glass-divider hover:bg-transparent">
                      <TableCell className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Skeleton className="size-9 rounded-lg" />
                          <Skeleton className="h-4 w-1/2" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {documents?.length === 0 && (
            <Empty className="glass border border-glass-border bg-glass">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileTextIcon />
                </EmptyMedia>
                <EmptyTitle>No documents yet</EmptyTitle>
                <EmptyDescription>Upload a Markdown, PDF, or Word file, or write a new one.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button asChild variant="glass">
                  <Link href="/library/new">
                    <FilePlusIcon />
                    Write a document
                  </Link>
                </Button>
              </EmptyContent>
            </Empty>
          )}

          {documents && documents.length > 0 && (
            <>
              {/* Search and filter */}
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <div className="relative min-w-0 flex-1 sm:max-w-xs">
                  {/* Above the glass input, which paints its own layer */}
                  <SearchIcon className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    aria-label="Search documents"
                    placeholder="Search documents"
                    value={search}
                    onChange={(e) => {
                      table.getColumn("filename")?.setFilterValue(e.target.value || undefined);
                      table.setPageIndex(0);
                    }}
                    className="glass h-10 rounded-xl border-glass-border bg-glass pl-9 dark:bg-glass"
                  />
                </div>
                <Select
                  value={type}
                  onValueChange={(v) => {
                    table.getColumn("type")?.setFilterValue(v === ALL_TYPES ? undefined : v);
                    table.setPageIndex(0);
                  }}
                >
                  <SelectTrigger aria-label="Filter by type" className="glass h-10! rounded-xl border-glass-border bg-glass px-3.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass border border-glass-border bg-glass-strong">
                    <SelectItem value={ALL_TYPES}>All types</SelectItem>
                    {types.map((t) => (
                      <SelectItem key={t} value={t}>
                        {KIND[t]?.label ?? "File"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="glass overflow-hidden rounded-xl border border-glass-border bg-glass">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((group) => (
                      <TableRow key={group.id} className="border-glass-divider hover:bg-transparent">
                        {group.headers.map((header) => (
                          <TableHead key={header.id} className={cn("h-12 px-3 text-muted-foreground first:pl-4 sm:px-5", metaClass(header.column.columnDef.meta))}>
                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={columns.length} className="py-10 text-center text-muted-foreground">
                          No documents match.
                        </TableCell>
                      </TableRow>
                    ) : (
                      table.getRowModel().rows.map((row) => (
                        <TableRow key={row.id} className="group border-glass-divider hover:bg-glass-strong">
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id} className={cn("px-3 py-4 text-muted-foreground first:pl-4 sm:px-5", metaClass(cell.column.columnDef.meta))}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination, once there's more than a page */}
              {filteredCount > pageSize && (
                <div className="mt-5 flex items-center justify-between gap-2 text-sm text-muted-foreground">
                  <span className="tabular-nums">
                    {pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, filteredCount)} of {filteredCount}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="glass" size="sm" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
                      Previous
                    </Button>
                    <Button variant="glass" size="sm" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function NameCell({ doc }: { doc: DocumentItem }) {
  const kind = kindOf(doc);
  const editable = doc.mimeType === "text/markdown";
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg text-white", kind.color)}>
        <FileTextIcon className="size-[18px]" />
      </span>
      <div className="min-w-0">
        {editable ? (
          <Link href={`/library/${doc.id}`} className="block truncate font-medium text-foreground hover:underline">
            {doc.filename}
          </Link>
        ) : (
          <p className="truncate font-medium text-foreground">{doc.filename}</p>
        )}
        {/* Details that have no column on small screens, or the reason it failed */}
        {doc.error ? (
          <p className="truncate text-sm">
            <span className="text-destructive sm:hidden">Couldn&apos;t read. </span>
            {doc.error}
          </p>
        ) : (
          <p className="truncate text-sm xl:hidden">
            {kind.label}, {formatSize(doc.sizeBytes)}
            {doc.status !== "ready" && <span className="sm:hidden">, {doc.status === "pending" ? "waiting" : "indexing"}</span>}
          </p>
        )}
      </div>
    </div>
  );
}

function Status({ doc }: { doc: DocumentItem }) {
  const queryClient = useQueryClient();
  const retry = useMutation({
    mutationFn: retryDocument,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });

  switch (doc.status) {
    case "ready":
      return <span className="whitespace-nowrap tabular-nums">{doc.chunkCount} {doc.chunkCount === 1 ? "section" : "sections"}</span>;
    case "processing":
      return (
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <Spinner />
          Indexing
        </span>
      );
    case "pending":
      return <span role="status">Waiting</span>;
    case "failed":
      return (
        <span className="flex items-center gap-3 whitespace-nowrap">
          <span className="text-destructive">Couldn&apos;t read</span>
          <Button variant="link" className="h-auto p-0" disabled={retry.isPending} onClick={() => retry.mutate(doc.id)}>
            Retry
          </Button>
        </span>
      );
  }
}

function RowActions({ doc }: { doc: DocumentItem }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const retry = useMutation({
    mutationFn: retryDocument,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });
  const remove = useMutation({
    mutationFn: deleteDocument,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["documents"] });
      const previous = queryClient.getQueryData<DocumentItem[]>(["documents"]);
      queryClient.setQueryData<DocumentItem[]>(["documents"], (docs) => docs?.filter((d) => d.id !== id));
      return { previous };
    },
    onSuccess: (result, _id, ctx) => {
      if (!result.ok) queryClient.setQueryData(["documents"], ctx?.previous);
    },
    onError: (_err, _id, ctx) => queryClient.setQueryData(["documents"], ctx?.previous),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
    },
  });

  return (
    <div className="-mr-2 flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`More options for ${doc.filename}`} className="text-muted-foreground">
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {doc.mimeType === "text/markdown" && (
            <>
              <DropdownMenuItem asChild>
                <Link href={`/library/${doc.id}`}>
                  <PencilIcon />
                  Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {doc.status === "failed" && (
            <>
              <DropdownMenuItem onSelect={() => retry.mutate(doc.id)}>
                <RotateCcwIcon />
                Try again
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent className="glass border border-glass-border bg-glass-strong">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{doc.filename}”?</AlertDialogTitle>
            <AlertDialogDescription>It will be removed from your library, its spaces, and search.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => remove.mutate(doc.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
