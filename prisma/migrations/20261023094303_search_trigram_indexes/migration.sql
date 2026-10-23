-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateIndex
CREATE INDEX "Artist_name_trgm_idx" ON "Artist" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Event_title_trgm_idx" ON "Event" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "User_username_trgm_idx" ON "User" USING GIN ("username" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "User_displayName_trgm_idx" ON "User" USING GIN ("displayName" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Venue_name_trgm_idx" ON "Venue" USING GIN ("name" gin_trgm_ops);
