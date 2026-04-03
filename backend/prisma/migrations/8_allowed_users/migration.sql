CREATE TABLE `AllowedUser` (
  `id`        INT NOT NULL AUTO_INCREMENT,
  `email`     VARCHAR(191) NOT NULL,
  `name`      VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `AllowedUser_email_key`(`email`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
