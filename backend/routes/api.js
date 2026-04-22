const express = require("express");
const jwt = require("jsonwebtoken");
const adminController = require("../controllers/adminController");
const auditController = require("../controllers/auditController");

const router = express.Router();

function adminAuth(req, res, next) {
  const token = req.headers["x-admin-token"] || req.query._token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  // รองรับ JWT token (จาก Google login)
  if (token.startsWith("eyJ")) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.adminUser = payload;
      return next();
    } catch {
      return res.status(401).json({ error: "Token หมดอายุหรือไม่ถูกต้อง" });
    }
  }

  // Fallback: ADMIN_SECRET (สำหรับ internal/script use)
  if (token === process.env.ADMIN_SECRET) {
    req.adminUser = { email: "system" };
    return next();
  }

  res.status(401).json({ error: "Unauthorized" });
}

router.use(adminAuth);

// Tickets
router.get("/tickets/export",         adminController.exportTickets);
router.get("/tickets",                adminController.listTickets);
router.get("/tickets/:id",            adminController.getTicket);
router.patch("/tickets/:id/assign",   adminController.assignTicket);
router.patch("/tickets/:id/close",    adminController.closeTicket);
router.patch("/tickets/:id/status",   adminController.updateTicketStatus);
router.patch("/tickets/:id/cost",          adminController.updateTicketCost);
router.patch("/tickets/:id/close-cost",    adminController.closeWithCost);
router.get("/stats",                  adminController.getStats);

// Assignees
router.get("/assignees",              adminController.listAssignees);
router.post("/assignees",             adminController.createAssignee);
router.put("/assignees/:id",          adminController.updateAssignee);
router.delete("/assignees/:id",       adminController.deleteAssignee);

// Categories
router.get("/categories",                        adminController.listCategories);
router.post("/categories",                       adminController.createCategory);
router.put("/categories/:id",                    adminController.updateCategory);
router.delete("/categories/:id",                 adminController.deleteCategory);
router.post("/categories/:id/subcategories",     adminController.createSubcategory);
router.put("/subcategories/:id",                 adminController.updateSubcategory);
router.delete("/subcategories/:id",              adminController.deleteSubcategory);

// FAQ
router.get("/faq",        adminController.listFaqs);
router.post("/faq",       adminController.createFaq);
router.put("/faq/:id",    adminController.updateFaq);
router.delete("/faq/:id", adminController.deleteFaq);

// Bookings
router.get("/bookings/month",                 adminController.listBookingsMonth);
router.get("/bookings/export",                adminController.exportBookings);
router.get("/bookings",                       adminController.listBookings);
router.get("/rooms",                          adminController.listRooms);
router.post("/rooms",                         adminController.createRoom);
router.put("/rooms/:id",                      adminController.updateRoom);
router.delete("/rooms/:id",                   adminController.deleteRoom);
router.patch("/bookings/:id/cancel",          adminController.cancelBookingAdmin);
router.patch("/rooms/:id/calendar",           adminController.updateRoomCalendar);
router.post("/rooms/:id/create-calendar",     adminController.createRoomCalendar);

// System config
router.get("/config",                      adminController.getConfig);
router.put("/config",                      adminController.updateConfig);
router.post("/config/test-notify",         adminController.testNotifyGroup);

// Calendar debug
router.get("/calendar/test",               adminController.testCalendar);

// Allowed Users
router.get("/allowed-users",         adminController.listAllowedUsers);
router.post("/allowed-users",        adminController.createAllowedUser);
router.delete("/allowed-users/:id",  adminController.deleteAllowedUser);

// Audit Logs
router.get("/audit-logs",         auditController.listAuditLogs);
router.get("/audit-logs/export",  auditController.exportAuditLogs);
router.get("/audit-logs/actions", auditController.getAuditActions);

module.exports = router;
