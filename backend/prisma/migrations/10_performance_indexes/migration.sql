-- Performance indexes for Ticket table
CREATE INDEX `Ticket_status_createdAt_idx` ON `Ticket`(`status`, `createdAt` DESC);
CREATE INDEX `Ticket_email_idx` ON `Ticket`(`email`);
CREATE INDEX `Ticket_category_idx` ON `Ticket`(`category`);
CREATE INDEX `Ticket_assignee_idx` ON `Ticket`(`assignee`);

-- Performance indexes for RoomBooking table
CREATE INDEX `RoomBooking_status_idx` ON `RoomBooking`(`status`);
CREATE INDEX `RoomBooking_roomId_status_startAt_idx` ON `RoomBooking`(`roomId`, `status`, `startAt`);
