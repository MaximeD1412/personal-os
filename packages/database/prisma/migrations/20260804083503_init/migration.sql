-- CreateTable
CREATE TABLE "HealthProbe" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthProbe_pkey" PRIMARY KEY ("id")
);
