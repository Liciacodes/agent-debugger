-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('running', 'answered', 'max_rounds', 'cut_off', 'model_error');

-- CreateEnum
CREATE TYPE "StepType" AS ENUM ('model', 'tool', 'answer');

-- CreateTable
CREATE TABLE "Run" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "status" "RunStatus" NOT NULL,
    "answer" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Step" (
    "runId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "type" "StepType" NOT NULL,
    "name" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "startMs" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "tokens" INTEGER,
    "input" TEXT,
    "output" TEXT,
    "reasoning" TEXT,
    "ok" BOOLEAN NOT NULL,
    "error" TEXT,

    CONSTRAINT "Step_pkey" PRIMARY KEY ("runId","id")
);

-- CreateIndex
CREATE INDEX "Run_startedAt_idx" ON "Run"("startedAt");

-- CreateIndex
CREATE INDEX "Step_runId_position_idx" ON "Step"("runId", "position");

-- AddForeignKey
ALTER TABLE "Step" ADD CONSTRAINT "Step_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
