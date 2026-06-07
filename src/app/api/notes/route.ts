import { NextResponse } from "next/server";
import { embedText, toVectorLiteral } from "@/src/lib/embeddings";
import { prisma } from "@/src/lib/prisma";

export const runtime = "nodejs";

type NoteSearchResult = {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  similarity: number;
};

function toIlikePattern(query: string) {
  const escaped = query.replace(/[%_\\]/g, "\\$&");
  return `%${escaped}%`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim();
  const limit = Math.min(Number(searchParams.get("limit") ?? 10), 50);

  if (!query) {
    const notes = await prisma.note.findMany({
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(notes);
  }

  const queryEmbedding = toVectorLiteral(await embedText(query));
  const ilikePattern = toIlikePattern(query);

  const notes = await prisma.$queryRaw<NoteSearchResult[]>`
    SELECT
      id,
      title,
      content,
      "createdAt",
      "updatedAt",
      GREATEST(
        COALESCE(1 - (embedding <=> ${queryEmbedding}::vector), 0),
        CASE
          WHEN content ILIKE ${ilikePattern} OR title ILIKE ${ilikePattern} THEN 1.0
          ELSE 0
        END
      ) AS similarity
    FROM notes
    WHERE
      embedding IS NOT NULL
      OR content ILIKE ${ilikePattern}
      OR title ILIKE ${ilikePattern}
    ORDER BY similarity DESC
    LIMIT ${limit}
  `;

  return NextResponse.json(notes);
}

export async function POST(request: Request) {
  const { title, content } = await request.json();
  const embedding = toVectorLiteral(await embedText(content));

  const note = await prisma.note.create({
    data: { title, content },
  });

  await prisma.$executeRaw`
    UPDATE notes
    SET embedding = ${embedding}::vector
    WHERE id = ${note.id}
  `;

  return NextResponse.json(note, { status: 201 });
}
