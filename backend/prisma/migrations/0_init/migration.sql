-- CreateTable
CREATE TABLE `Ticket` (
  `id`          INT NOT NULL AUTO_INCREMENT,
  `ticketNo`    VARCHAR(191) NOT NULL,
  `lineUserId`  VARCHAR(191) NOT NULL,
  `displayName` VARCHAR(191),
  `title`       VARCHAR(191) NOT NULL,
  `category`    VARCHAR(191) NOT NULL,
  `subcategory` VARCHAR(191) NOT NULL,
  `location`    VARCHAR(191) NOT NULL,
  `description` TEXT NOT NULL,
  `assetTag`    VARCHAR(191),
  `imageUrl`    VARCHAR(191),
  `status`      VARCHAR(191) NOT NULL DEFAULT 'pending',
  `priority`    VARCHAR(191) NOT NULL DEFAULT 'medium',
  `assignee`    VARCHAR(191),
  `resolution`  TEXT,
  `rating`      INT,
  `createdAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3) NOT NULL,
  `completedAt` DATETIME(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Ticket_ticketNo_key` (`ticketNo`),
  INDEX `Ticket_lineUserId_idx` (`lineUserId`),
  INDEX `Ticket_status_idx` (`status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserSession` (
  `lineUserId` VARCHAR(191) NOT NULL,
  `state`      VARCHAR(191) NOT NULL DEFAULT 'idle',
  `tempData`   JSON,
  `updatedAt`  DATETIME(3) NOT NULL,
  PRIMARY KEY (`lineUserId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketCounter` (
  `id`    INT NOT NULL DEFAULT 1,
  `count` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed counter
INSERT INTO `TicketCounter` (`id`, `count`) VALUES (1, 0);
