-- Ticket: make priority nullable, add work/cost fields
ALTER TABLE `Ticket`
  MODIFY COLUMN `priority` VARCHAR(20) NULL,
  ADD COLUMN `workStartAt` DATETIME(3) NULL,
  ADD COLUMN `hasCost` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `costDescription` TEXT NULL,
  ADD COLUMN `costAmount` DECIMAL(10,2) NULL,
  ADD COLUMN `costVat` DECIMAL(10,2) NULL,
  ADD COLUMN `repairVendor` VARCHAR(255) NULL;

-- Assignee table
CREATE TABLE `Assignee` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Assignee_name_key` (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed default assignees
INSERT INTO `Assignee` (`name`) VALUES
  ('พี่โจ้ (IT Support)'),
  ('พี่เอก (IT Support)'),
  ('พี่นิด (IT Support)');
