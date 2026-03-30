-- CreateTable Category
CREATE TABLE `Category` (
  `id`        INT NOT NULL AUTO_INCREMENT,
  `name`      VARCHAR(191) NOT NULL,
  `icon`      VARCHAR(191) NOT NULL DEFAULT '📋',
  `color`     VARCHAR(191) NOT NULL DEFAULT '#457b9d',
  `isActive`  BOOLEAN NOT NULL DEFAULT TRUE,
  `order`     INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Category_name_key` (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable Subcategory
CREATE TABLE `Subcategory` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `name`       VARCHAR(191) NOT NULL,
  `categoryId` INT NOT NULL,
  `isActive`   BOOLEAN NOT NULL DEFAULT TRUE,
  `order`      INT NOT NULL DEFAULT 0,
  `createdAt`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `Subcategory_categoryId_idx` (`categoryId`),
  CONSTRAINT `Subcategory_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable FaqItem
CREATE TABLE `FaqItem` (
  `id`        INT NOT NULL AUTO_INCREMENT,
  `question`  VARCHAR(191) NOT NULL,
  `answer`    TEXT NOT NULL,
  `isActive`  BOOLEAN NOT NULL DEFAULT TRUE,
  `order`     INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed default categories
INSERT INTO `Category` (`name`, `icon`, `color`, `order`) VALUES
('Hardware', '🖥️', '#e63946', 1),
('Software', '💻', '#457b9d', 2),
('Network',  '🌐', '#2a9d8f', 3),
('Account',  '👤', '#e9c46a', 4);

-- Seed subcategories
INSERT INTO `Subcategory` (`name`, `categoryId`, `order`) VALUES
('Desktop/PC', 1, 1), ('Notebook/Laptop', 1, 2), ('Printer / Scanner', 1, 3), ('Monitor', 1, 4), ('Keyboard/Mouse', 1, 5), ('อื่นๆ (Hardware)', 1, 6),
('Windows / OS', 2, 1), ('Microsoft Office', 2, 2), ('Email / Outlook', 2, 3), ('โปรแกรมใช้งานภายใน', 2, 4), ('Antivirus', 2, 5), ('อื่นๆ (Software)', 2, 6),
('อินเทอร์เน็ตช้า / หลุด', 3, 1), ('Wi-Fi เชื่อมต่อไม่ได้', 3, 2), ('VPN / Remote Access', 3, 3), ('Network Drive / Share', 3, 4), ('IP / DHCP', 3, 5), ('อื่นๆ (Network)', 3, 6),
('ลืมรหัสผ่าน', 4, 1), ('Account ถูกล็อก', 4, 2), ('ขอสิทธิ์ระบบ', 4, 3), ('Email ไม่ทำงาน', 4, 4), ('Active Directory', 4, 5), ('อื่นๆ (Account)', 4, 6);

-- Seed FAQ
INSERT INTO `FaqItem` (`question`, `answer`, `order`) VALUES
('เน็ตหลุด / ช้า', '🔄 ลอง Restart Router/Switch ก่อนครับ หากยังไม่ดีขึ้นให้แจ้ง IT', 1),
('Printer ไม่ออก', '🖨️ Clear print queue แล้ว Restart Print Spooler\n1. กด Win+R พิมพ์ services.msc\n2. หา Print Spooler > Restart', 2),
('ลืมรหัส Windows', '🔑 ติดต่อ IT ที่ ext. 1000 หรือแจ้งผ่านระบบนี้ได้เลย', 3),
('Outlook ไม่ sync', '📧 ไปที่ Account Settings > Repair แล้วรอจนเสร็จ', 4),
('เครื่องช้า', '💻 ลอง Restart เครื่องก่อน แล้วตรวจ Task Manager ดูว่ามีโปรแกรมกิน CPU/RAM สูงมั้ย', 5);
