CREATE TABLE `SystemConfig` (
  `key`   VARCHAR(100) NOT NULL,
  `value` LONGTEXT     NOT NULL,
  PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed default contact info
INSERT INTO `SystemConfig` (`key`, `value`) VALUES
  ('contact_phone',   '02-xxx-xxxx'),
  ('contact_email',   'it@company.com'),
  ('contact_hours',   'จันทร์–ศุกร์ 08:00–18:00'),
  ('contact_line',    ''),
  ('contact_name',    'ทีม IT Support');
