-- CreateTable
CREATE TABLE `payables` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `payableNumber` VARCHAR(191) NOT NULL,
    `vendorName` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `referenceNumber` VARCHAR(191) NULL,
    `amount` DECIMAL(20, 2) NOT NULL,
    `paidAmount` DECIMAL(20, 2) NOT NULL DEFAULT 0,
    `remainingAmount` DECIMAL(20, 2) NOT NULL,
    `dueDate` DATE NOT NULL,
    `status` ENUM('OPEN', 'PARTIAL', 'PAID', 'VOID') NOT NULL DEFAULT 'OPEN',
    `payableAccountId` INTEGER NOT NULL,
    `journalId` INTEGER NOT NULL,
    `createdById` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payables_payableNumber_key`(`payableNumber`),
    UNIQUE INDEX `payables_journalId_key`(`journalId`),
    INDEX `payables_status_idx`(`status`),
    INDEX `payables_dueDate_idx`(`dueDate`),
    INDEX `payables_vendorName_idx`(`vendorName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payable_payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `payableId` INTEGER NOT NULL,
    `paymentDate` DATE NOT NULL,
    `amount` DECIMAL(20, 2) NOT NULL,
    `cashAccountId` INTEGER NOT NULL,
    `description` TEXT NULL,
    `journalId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `payable_payments_journalId_key`(`journalId`),
    INDEX `payable_payments_payableId_idx`(`payableId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `payables` ADD CONSTRAINT `payables_payableAccountId_fkey` FOREIGN KEY (`payableAccountId`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payables` ADD CONSTRAINT `payables_journalId_fkey` FOREIGN KEY (`journalId`) REFERENCES `journals`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payables` ADD CONSTRAINT `payables_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payable_payments` ADD CONSTRAINT `payable_payments_payableId_fkey` FOREIGN KEY (`payableId`) REFERENCES `payables`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payable_payments` ADD CONSTRAINT `payable_payments_cashAccountId_fkey` FOREIGN KEY (`cashAccountId`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payable_payments` ADD CONSTRAINT `payable_payments_journalId_fkey` FOREIGN KEY (`journalId`) REFERENCES `journals`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
