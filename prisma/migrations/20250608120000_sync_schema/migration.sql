-- Add soft-delete column
ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Remove unused tag tables (legacy from earlier schema)
ALTER TABLE IF EXISTS "note_tags" DROP CONSTRAINT IF EXISTS "note_tags_noteId_fkey";
ALTER TABLE IF EXISTS "note_tags" DROP CONSTRAINT IF EXISTS "note_tags_tagId_fkey";
DROP TABLE IF EXISTS "note_tags";
DROP TABLE IF EXISTS "tags";
