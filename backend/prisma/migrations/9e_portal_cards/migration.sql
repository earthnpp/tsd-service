CREATE TABLE `PortalCard` (
  `id`          INT          NOT NULL AUTO_INCREMENT,
  `title`       VARCHAR(191) NOT NULL,
  `description` LONGTEXT     NULL,
  `icon`        VARCHAR(191) NOT NULL DEFAULT '🔗',
  `url`         VARCHAR(191) NOT NULL,
  `color`       VARCHAR(191) NOT NULL DEFAULT '#1a3a5c',
  `isActive`    BOOLEAN      NOT NULL DEFAULT TRUE,
  `order`       INT          NOT NULL DEFAULT 0,
  `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed default cards
INSERT INTO `PortalCard` (`title`, `description`, `icon`, `url`, `color`, `isActive`, `order`, `updatedAt`) VALUES
('IT Helpdesk',       'แจ้งปัญหาและติดตาม Ticket ด้านระบบ IT',         '🛠️',  '/liff/report',    '#e63946', TRUE, 1, NOW()),
('จองห้องประชุม',      'จองห้องประชุมและดูตารางว่าง',                    '🗓️',  '/liff/booking',   '#457b9d', TRUE, 2, NOW()),
('AI Assistant',      'ถามปัญหา IT เบื้องต้นกับ AI',                   '🤖',  '/liff/ai',        '#1a3a5c', TRUE, 3, NOW()),
('HR Self-Service',   'ลางาน ดูประวัติ และจัดการข้อมูลพนักงาน',         '👤',  '#',               '#2a9d8f', TRUE, 4, NOW()),
('Finance Portal',    'เบิกค่าใช้จ่าย ดูสลิปเงินเดือน',                '💰',  '#',               '#f4a261', TRUE, 5, NOW()),
('Document Center',   'คลังเอกสาร นโยบาย และแบบฟอร์มบริษัท',           '📄',  '#',               '#6d6875', TRUE, 6, NOW());
