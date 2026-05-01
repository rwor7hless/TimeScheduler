-- AlterTable
ALTER TABLE "boards" ADD COLUMN     "group_id" INTEGER,
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "board_groups" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "board_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ix_board_groups_user_order" ON "board_groups"("user_id", "sort_order");

-- CreateIndex
CREATE INDEX "ix_boards_user_group_order" ON "boards"("user_id", "group_id", "sort_order");

-- AddForeignKey
ALTER TABLE "boards" ADD CONSTRAINT "boards_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "board_groups"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "board_groups" ADD CONSTRAINT "board_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
