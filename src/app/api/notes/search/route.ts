import { NextResponse } from "next/server";

import { prisma } from "@/src/lib/prisma";
import { isValidEmbedding, toVectorLiteral } from "@/src/lib/vector";

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

async function searchByText(query: string, limit: number) {
  const ilikePattern = toIlikePattern(query);

  return prisma.$queryRaw<NoteSearchResult[]>`
    SELECT
      id,
      title,
      content,
      "createdAt",
      "updatedAt",
      CASE
        WHEN content ILIKE ${ilikePattern} OR title ILIKE ${ilikePattern} THEN 1.0
        ELSE 0
      END AS similarity
    FROM notes
    WHERE content ILIKE ${ilikePattern} OR title ILIKE ${ilikePattern}
    ORDER BY "updatedAt" DESC
    LIMIT ${limit}
  `;
}

async function searchHybrid(
  query: string,
  embedding: number[],
  limit: number,
) {
  const queryEmbedding = toVectorLiteral(embedding);
  const ilikePattern = toIlikePattern(query);

  return prisma.$queryRaw<NoteSearchResult[]>`
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
}

export async function POST(request: Request) {
  const body = await request.json();
  const query = typeof body.query === "string" ? body.query.trim() : "";
  const limit = Math.min(Number(body.limit ?? 10), 50);

  if (!query) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  const notes = isValidEmbedding(body.embedding)
    ? await searchHybrid(query, body.embedding, limit)
    : await searchByText(query, limit);

  return NextResponse.json(notes);
}
