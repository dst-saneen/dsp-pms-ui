-- CreateTable
CREATE TABLE "task_reviews" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "comments" TEXT,
    "reviewHours" DECIMAL(65,30) DEFAULT 0,
    "reviewRound" INTEGER NOT NULL DEFAULT 1,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_reviews_submissionId_idx" ON "task_reviews"("submissionId");

-- CreateIndex
CREATE INDEX "task_reviews_reviewerId_idx" ON "task_reviews"("reviewerId");

-- AddForeignKey
ALTER TABLE "task_reviews" ADD CONSTRAINT "task_reviews_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "task_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_reviews" ADD CONSTRAINT "task_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
