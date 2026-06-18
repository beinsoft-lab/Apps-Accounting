-- CreateTable
CREATE TABLE `receivables` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `receivableNumber` VARCHAR(191) NOT NULL,
    `customerName` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `referenceNumber` VARCHAR(191) NULL,
    `amount` DECIMAL(20, 2) NOT NULL,
    `paidAmount` DECIMAL(20, 2) NOT NULL DEFAULT 0,
    `remainingAmount` DECIMAL(20, 2) NOT NULL,
    `dueDate` DATE NOT NULL,
    `status` ENUM('OPEN', 'PARTIAL', 'PAID', 'VOID') NOT NULL DEFAULT 'OPEN',
    `receivableAccountId` INTEGER NOT NULL,
    `journalId` INTEGER NOT NULL,
    `createdById` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `receivables_receivableNumber_key`(`receivableNumber`),
    UNIQUE INDEX `receivables_journalId_key`(`journalId`),
    INDEX `receivables_status_idx`(`status`),
    INDEX `receivables_dueDate_idx`(`dueDate`),
    INDEX `receivables_customerName_idx`(`customerName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `receivable_payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `receivableId` INTEGER NOT NULL,
    `paymentDate` DATE NOT NULL,
    `amount` DECIMAL(20, 2) NOT NULL,
    `cashAccountId` INTEGER NOT NULL,
    `description` TEXT NULL,
    `journalId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `receivable_payments_journalId_key`(`journalId`),
    INDEX `receivable_payments_receivableId_idx`(`receivableId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `receivables` ADD CONSTRAINT `receivables_receivableAccountId_fkey` FOREIGN KEY (`receivableAccountId`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receivables` ADD CONSTRAINT `receivables_journalId_fkey` FOREIGN KEY (`journalId`) REFERENCES `journals`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receivables` ADD CONSTRAINT `receivables_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receivable_payments` ADD CONSTRAINT `receivable_payments_receivableId_fkey` FOREIGN KEY (`receivableId`) REFERENCES `receivables`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receivable_payments` ADD CONSTRAINT `receivable_payments_cashAccountId_fkey` FOREIGN KEY (`cashAccountId`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receivable_payments` ADD CONSTRAINT `receivable_payments_journalId_fkey` FOREIGN KEY (`journalId`) REFERENCES `journals`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
