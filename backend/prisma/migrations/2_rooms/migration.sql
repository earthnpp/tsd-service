-- CreateTable Room
CREATE TABLE `Room` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL,
  `calendarId` VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Room_name_key` (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable RoomBooking
CREATE TABLE `RoomBooking` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `bookingNo` VARCHAR(20) NOT NULL,
  `roomId` INT NOT NULL,
  `lineUserId` VARCHAR(100) NOT NULL,
  `displayName` VARCHAR(255) NULL,
  `title` VARCHAR(255) NOT NULL,
  `startAt` DATETIME(3) NOT NULL,
  `endAt` DATETIME(3) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'confirmed',
  `googleEventId` VARCHAR(255) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `RoomBooking_bookingNo_key` (`bookingNo`),
  INDEX `RoomBooking_roomId_idx` (`roomId`),
  INDEX `RoomBooking_lineUserId_idx` (`lineUserId`),
  INDEX `RoomBooking_startAt_idx` (`startAt`),
  CONSTRAINT `RoomBooking_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `Room` (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable BookingCounter
CREATE TABLE `BookingCounter` (
  `id` INT NOT NULL DEFAULT 1,
  `count` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed 5 rooms
INSERT INTO `Room` (`name`) VALUES
  ('TSD-B1-01'),
  ('TSD-B1-02'),
  ('TSD-B1-03'),
  ('TSD-B1-04'),
  ('TSD-B1-05');

-- Seed counter
INSERT INTO `BookingCounter` (`id`, `count`) VALUES (1, 0);
