"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Loader2, NotebookPen, Sparkles, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { embedText } from "@/src/lib/embeddings";
import { cn } from "@/src/lib/utils";

import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Textarea } from "@/src/components/ui/textarea";

type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  similarity?: number;
};

function parseNote(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return { title: "", content: "" };
  }

  const [firstLine = ""] = trimmed.split("\n");
  const title = firstLine.slice(0, 80) || "Untitled";

  return { title, content: trimmed };
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDateGroup(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameDay(date, today)) {
    return "Today";
  }

  if (isSameDay(date, yesterday)) {
    return "Yesterday";
  }

  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

function groupNotesByDate(notes: Note[]) {
  const sorted = [...notes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const groups: { label: string; notes: Note[] }[] = [];
  const indexByLabel = new Map<string, number>();

  for (const note of sorted) {
    const label = formatDateGroup(note.createdAt);
    const existingIndex = indexByLabel.get(label);

    if (existingIndex === undefined) {
      indexByLabel.set(label, groups.length);
      groups.push({ label, notes: [note] });
    } else {
      groups[existingIndex]?.notes.push(note);
    }
  }

  return groups;
}

const noteListTransition = { duration: 0.24, ease: "easeOut" as const };
const noteLayoutTransition = { layout: { duration: 0.24, ease: "easeOut" as const } };

function AnimatedNoteItem({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 14 }}
      transition={{ ...noteListTransition, ...noteLayoutTransition }}
    >
      {children}
    </motion.div>
  );
}

function NoteCard({
  note,
  showSimilarity = false,
  onDelete,
  isDeleting = false,
}: {
  note: Note;
  showSimilarity?: boolean;
  onDelete?: (id: string) => void;
  isDeleting?: boolean;
}) {
  return (
    <Card className="retro-paper group relative">
      {onDelete ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isDeleting}
          onClick={() => onDelete(note.id)}
          className={cn(
            "text-muted-foreground absolute right-2 bottom-2 size-8 p-0 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-transparent hover:text-destructive cursor-pointer",
            isDeleting && "opacity-100",
          )}
          aria-label={`Delete note: ${note.title}`}
        >
          {isDeleting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
        </Button>
      ) : null}
      <CardHeader className="gap-2 py-4">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="font-serif text-base leading-snug">
            {note.title}
          </CardTitle>
          {showSimilarity && note.similarity !== undefined ? (
            <span className="bg-secondary text-secondary-foreground shrink-0 rounded-sm border border-border px-2 py-1 text-xs tabular-nums">
              {Math.round(Number(note.similarity) * 100)}% match
            </span>
          ) : null}
        </div>
        <CardDescription className="line-clamp-3 font-serif text-sm leading-6">
          {note.content}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

function SimilarNotesPanel({
  showSimilarPanel,
  isSearching,
  similarNotes,
  className,
  emptyMessage = "Start typing in the box. Matches show up here.",
  onDelete,
  deletingId,
}: {
  showSimilarPanel: boolean;
  isSearching: boolean;
  similarNotes: Note[];
  className?: string;
  emptyMessage?: string;
  onDelete?: (id: string) => void;
  deletingId?: string | null;
}) {
  return (
    <section className={className}>
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="text-primary size-4" />
        <h2 className="font-serif text-lg">Similar notes</h2>
      </div>

      {!showSimilarPanel ? (
        <Card className="retro-paper">
          <CardContent className="text-muted-foreground py-8 text-sm leading-6">
            {emptyMessage}
          </CardContent>
        </Card>
      ) : isSearching ? (
        <Card className="retro-paper">
          <CardContent className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Looking through your notes...
          </CardContent>
        </Card>
      ) : (
        <motion.div layout className="flex flex-col gap-3">
          <AnimatePresence initial={false} mode="popLayout">
            {similarNotes.map((note) => (
              <AnimatedNoteItem key={note.id}>
                <NoteCard
                  note={note}
                  showSimilarity
                  onDelete={onDelete}
                  isDeleting={deletingId === note.id}
                />
              </AnimatedNoteItem>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </section>
  );
}

export function NoteComposer() {
  const [text, setText] = useState("");
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [similarNotes, setSimilarNotes] = useState<Note[]>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const groupedNotes = useMemo(() => groupNotesByDate(allNotes), [allNotes]);

  const loadAllNotes = useCallback(async () => {
    try {
      const response = await fetch("/api/notes");
      if (!response.ok) {
        throw new Error("Failed to load notes");
      }
      setAllNotes((await response.json()) as Note[]);
    } catch {
      setAllNotes([]);
    } finally {
      setIsLoadingNotes(false);
    }
  }, []);

  useEffect(() => {
    void loadAllNotes();
  }, [loadAllNotes]);

  useEffect(() => {
    const trimmed = text.trim();

    if (trimmed.length < 3) {
      setSimilarNotes([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const embedding = await embedText(trimmed);
        const response = await fetch("/api/notes/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: trimmed,
            ...(embedding ? { embedding } : {}),
            limit: 5,
          }),
        });

        if (!response.ok) {
          throw new Error("Search failed");
        }

        const results = (await response.json()) as Note[];
        setSimilarNotes(
          results.filter((note) => (note.similarity ?? 0) > 0.35),
        );
      } catch {
        setSimilarNotes([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [text]);

  const handleCreate = useCallback(async () => {
    const { title, content } = parseNote(text);

    if (!content) {
      return;
    }

    setIsCreating(true);
    setMessage(null);

    try {
      const embedding = await embedText(content);
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          ...(embedding ? { embedding } : {}),
        }),
      });

      if (!response.ok) {
        throw new Error("Create failed");
      }

      setText("");
      setSimilarNotes([]);
      setMessage("Note saved.");
      await loadAllNotes();
    } catch {
      setMessage("Could not save note. Try again.");
    } finally {
      setIsCreating(false);
    }
  }, [text, loadAllNotes]);

  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id);
    setMessage(null);

    try {
      const response = await fetch(`/api/notes/${id}`, { method: "DELETE" });

      if (!response.ok) {
        throw new Error("Delete failed");
      }

      setAllNotes((notes) => notes.filter((note) => note.id !== id));
      setSimilarNotes((notes) => notes.filter((note) => note.id !== id));
    } catch {
      setMessage("Could not delete note. Try again.");
    } finally {
      setDeletingId(null);
    }
  }, []);

  const hasText = text.trim().length > 0;
  const showSimilarPanel = hasText && (isSearching || similarNotes.length > 0);

  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      <div className="flex min-w-0 flex-col gap-8">
        <header className="text-center lg:text-left">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full border border-border bg-card shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_2px_0_rgba(61,41,20,0.1)] lg:mx-0">
            <NotebookPen className="size-5 text-primary" />
          </div>
          <p className="text-primary/80 text-xs font-medium tracking-[0.35em] uppercase">
            Noted
          </p>
          <h1 className="text-foreground mt-2 font-serif text-4xl tracking-tight">
            Write it down
          </h1>
          <p className="text-muted-foreground mx-auto mt-3 max-w-md text-sm leading-6 lg:mx-0">
            Start typing. We quietly check if something similar already lives in
            your stack of notes.
          </p>
        </header>

        <Card className="retro-paper overflow-hidden">
          <CardHeader className="border-border/70 border-b pb-4">
            <CardTitle className="font-serif text-xl">New note</CardTitle>
            <CardDescription>
              First line becomes the title. Keep going for the rest.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-4">
            <Textarea
              value={text}
              onChange={(event) => {
                setMessage(null);
                setText(event.target.value);
              }}
              placeholder={
                "Groceries for Tuesday...\neggs, bread, that mustard you like"
              }
              className="min-h-44 resize-none font-serif text-base leading-7"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-muted-foreground text-xs">
                {isSearching
                  ? "Checking for similar notes..."
                  : hasText
                    ? similarNotes.length > 0
                      ? `${similarNotes.length} similar note${similarNotes.length === 1 ? "" : "s"} found`
                      : "No close matches yet"
                    : "Start writing to search"}
              </p>

              <Button
                onClick={handleCreate}
                disabled={!hasText || isCreating}
                className="min-w-36"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Create note"
                )}
              </Button>
            </div>

            {message ? (
              <p className="text-primary text-sm font-medium">{message}</p>
            ) : null}
          </CardContent>
        </Card>

        {showSimilarPanel ? (
          <SimilarNotesPanel
            showSimilarPanel={showSimilarPanel}
            isSearching={isSearching}
            similarNotes={similarNotes}
            className="flex flex-col lg:hidden"
            onDelete={handleDelete}
            deletingId={deletingId}
          />
        ) : null}

        <section className="flex flex-col gap-5">
          <div className="flex items-center gap-2">
            <CalendarDays className="text-primary size-4" />
            <h2 className="font-serif text-lg">All notes</h2>
          </div>

          {isLoadingNotes ? (
            <Card className="retro-paper">
              <CardContent className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
                <Loader2 className="size-4 animate-spin" />
                Loading your notes...
              </CardContent>
            </Card>
          ) : groupedNotes.length === 0 ? (
            <Card className="retro-paper">
              <CardContent className="text-muted-foreground py-8 text-center text-sm">
                No notes yet. Write your first one above.
              </CardContent>
            </Card>
          ) : (
            <AnimatePresence initial={false} mode="popLayout">
              {groupedNotes.map((group) => (
                <motion.div
                  key={group.label}
                  layout
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ ...noteListTransition, ...noteLayoutTransition }}
                  className="flex flex-col gap-3"
                >
                  <h3 className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
                    {group.label}
                  </h3>
                  <div className="flex flex-col gap-3">
                    <AnimatePresence initial={false} mode="popLayout">
                      {group.notes.map((note) => (
                        <AnimatedNoteItem key={note.id}>
                          <NoteCard
                            note={note}
                            onDelete={handleDelete}
                            isDeleting={deletingId === note.id}
                          />
                        </AnimatedNoteItem>
                      ))}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </section>
      </div>

      <aside className="hidden flex-col gap-4 lg:sticky lg:top-8 lg:flex">
        <SimilarNotesPanel
          showSimilarPanel={showSimilarPanel}
          isSearching={isSearching}
          similarNotes={similarNotes}
          emptyMessage="Start typing in the box. Matches show up here on the right."
          onDelete={handleDelete}
          deletingId={deletingId}
        />
      </aside>
    </div>
  );
}
