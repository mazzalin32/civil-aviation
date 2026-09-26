-- AlterTable: unique constraints so the seed script can upsert by name (all tables empty at this point)
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");
CREATE UNIQUE INDEX "MatterType_name_key" ON "MatterType"("name");
CREATE UNIQUE INDEX "StageTemplate_matterTypeId_name_key" ON "StageTemplate"("matterTypeId", "name");
CREATE UNIQUE INDEX "Forum_name_key" ON "Forum"("name");
CREATE UNIQUE INDEX "EventType_name_key" ON "EventType"("name");
CREATE UNIQUE INDEX "DocumentFolder_name_key" ON "DocumentFolder"("name");
CREATE UNIQUE INDEX "Outcome_name_key" ON "Outcome"("name");
