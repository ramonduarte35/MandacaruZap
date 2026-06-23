-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "amazonId" TEXT,
    "shopeeId" TEXT,
    "mercadolivreId" TEXT,
    "mercadolivreChannel" TEXT,
    "mercadolivreTool" TEXT,
    "mercadolivreWord" TEXT,
    "mercadolivreCookie" TEXT,
    "cookieNotificationPhone" TEXT,
    "listenAmazon" BOOLEAN NOT NULL DEFAULT true,
    "listenShopee" BOOLEAN NOT NULL DEFAULT true,
    "listenMercadoLivre" BOOLEAN NOT NULL DEFAULT true,
    "mercadolivreOnlyShort" BOOLEAN NOT NULL DEFAULT false,
    "sendWindowStart" TEXT NOT NULL DEFAULT '08:00',
    "sendWindowEnd" TEXT NOT NULL DEFAULT '18:00',
    "dailyLimit" INTEGER NOT NULL DEFAULT 30,
    "minPriceAmazon" DOUBLE PRECISION,
    "minPriceShopee" DOUBLE PRECISION,
    "minPriceMeli" DOUBLE PRECISION,
    "enableDeduplication" BOOLEAN NOT NULL DEFAULT false,
    "deduplicationHours" INTEGER NOT NULL DEFAULT 24,
    "telegramBotToken" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappInstance" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "qrCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "WhatsappInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMapping" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceGroupId" TEXT NOT NULL,
    "sourceGroupName" TEXT,
    "destGroupIds" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,

    CONSTRAINT "GroupMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Log" (
    "id" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "convertedUrl" TEXT,
    "title" TEXT,
    "price" TEXT,
    "imageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CAPTURED',
    "errorMessage" TEXT,
    "sourceGroup" TEXT,
    "destGroups" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,

    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageQueue" (
    "id" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "convertedUrl" TEXT,
    "title" TEXT,
    "price" TEXT,
    "imageUrl" TEXT,
    "copy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "sourceGroup" TEXT,
    "destGroups" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,

    CONSTRAINT "MessageQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "WhatsappInstance" ADD CONSTRAINT "WhatsappInstance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMapping" ADD CONSTRAINT "GroupMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMapping" ADD CONSTRAINT "GroupMapping_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "WhatsappInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "WhatsappInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageQueue" ADD CONSTRAINT "MessageQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageQueue" ADD CONSTRAINT "MessageQueue_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "WhatsappInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
