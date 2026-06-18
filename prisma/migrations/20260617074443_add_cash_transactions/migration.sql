-- CreateTable
CREATE TABLE `cash_transactions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `transactionNumber` VARCHAR(191) NOT NULL,
    `type` ENUM('IN', 'OUT') NOT NULL,
    `transactionDate` DATE NOT NULL,
    `amount` DECIMAL(20, 2) NOT NULL,
    `cashAccountId` INTEGER NOT NULL,
    `counterpartAccountId` INTEGER NOT NULL,
    `description` TEXT NOT NULL,
    `referenceNumber` VARCHAR(191) NULL,
    `partyName` VARCHAR(191) NULL,
    `journalId` INTEGER NOT NULL,
    `createdById` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cash_transactions_transactionNumber_key`(`transactionNumber`),
    UNIQUE INDEX `cash_transactions_journalId_key`(`journalId`),
    INDEX `cash_transactions_type_transactionDate_idx`(`type`, `transactionDate`),
    INDEX `cash_transactions_cashAccountId_idx`(`cashAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `cash_transactions` ADD CONSTRAINT `cash_transactions_cashAccountId_fkey` FOREIGN KEY (`cashAccountId`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_transactions` ADD CONSTRAINT `cash_transactions_counterpartAccountId_fkey` FOREIGN KEY (`counterpartAccountId`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_transactions` ADD CONSTRAINT `cash_transactions_journalId_fkey` FOREIGN KEY (`journalId`) REFERENCES `journals`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_transactions` ADD CONSTRAINT `cash_transactions_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
