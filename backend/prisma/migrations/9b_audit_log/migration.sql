CREATE TABLE `AuditLog` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `timestamp`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `actor`        VARCHAR(255) NOT NULL,
  `actorType`    VARCHAR(20)  NOT NULL,
  `action`       VARCHAR(100) NOT NULL,
  `resourceType` VARCHAR(50)  NULL,
  `resourceId`   VARCHAR(100) NULL,
  `detail`       TEXT         NULL,
  `ipAddress`    VARCHAR(50)  NULL,
  `userAgent`    TEXT         NULL,
  PRIMARY KEY (`id`),
  INDEX `AuditLog_timestamp_idx` (`timestamp`),
  INDEX `AuditLog_actor_idx` (`actor`),
  INDEX `AuditLog_action_idx` (`action`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
