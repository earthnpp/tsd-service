ALTER TABLE `RoomBooking` ADD COLUMN `cancelledBy`     VARCHAR(191) NULL;
ALTER TABLE `RoomBooking` ADD COLUMN `cancelledAt`     DATETIME(3)  NULL;
ALTER TABLE `RoomBooking` ADD COLUMN `cancelledByType` VARCHAR(191) NULL;
