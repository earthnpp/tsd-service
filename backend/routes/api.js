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
    req.adminUser = { email: "system", permissions: null };
    return next();
  }

  res.status(401).json({ error: "Unauthorized" });
}

// null permissions = full access (INITIAL_ADMIN_EMAIL / system token)
function requirePermission(module) {
  return (req, res, next) => {
    const perms = req.adminUser?.permissions;
    if (perms === null || perms === undefined) return next();
    if (!Array.isArray(perms) || !perms.includes(module)) {
      return res.status(403).json({ error: "ไม่มีสิทธิ์เข้าถึงโมดูลนี้" });
    }
    next();
  };
}

router.use(adminAuth);

// Tickets
router.get("/tickets/export",           requirePermission("export"),    adminController.exportTickets);
router.get("/tickets",                  requirePermission("tickets"),   adminController.listTickets);
router.get("/tickets/:id",              requirePermission("tickets"),   adminController.getTicket);
router.patch("/tickets/:id/assign",     requirePermission("tickets"),   adminController.assignTicket);
router.patch("/tickets/:id/close",      requirePermission("tickets"),   adminController.closeTicket);
router.patch("/tickets/:id/status",     requirePermission("tickets"),   adminController.updateTicketStatus);
router.patch("/tickets/:id/cost",       requirePermission("tickets"),   adminController.updateTicketCost);
router.patch("/tickets/:id/close-cost", requirePermission("tickets"),   adminController.closeWithCost);
router.get("/stats",                    requirePermission("dashboard"), adminController.getStats);

// Assignees — GET open (needed by tickets tab), writes need settings
router.get("/assignees",              adminController.listAssignees);
router.post("/assignees",             requirePermission("settings"), adminController.createAssignee);
router.put("/assignees/:id",          requirePermission("settings"), adminController.updateAssignee);
router.delete("/assignees/:id",       requirePermission("settings"), adminController.deleteAssignee);

// Categories — GET open (needed by tickets filter), writes need settings
router.get("/categories",                        adminController.listCategories);
router.post("/categories",                       requirePermission("settings"), adminController.createCategory);
router.put("/categories/:id",                    requirePermission("settings"), adminController.updateCategory);
router.delete("/categories/:id",                 requirePermission("settings"), adminController.deleteCategory);
router.post("/categories/:id/subcategories",     requirePermission("settings"), adminController.createSubcategory);
router.put("/subcategories/:id",                 requirePermission("settings"), adminController.updateSubcategory);
router.delete("/subcategories/:id",              adminController.deleteSubcategory);

// FAQ
router.get("/faq",        requirePermission("settings"), adminController.listFaqs);
router.post("/faq",       requirePermission("settings"), adminController.createFaq);
router.put("/faq/:id",    requirePermission("settings"), adminController.updateFaq);
router.delete("/faq/:id", requirePermission("settings"), adminController.deleteFaq);

// Bookings
router.get("/bookings/month",             requirePermission("bookings"), adminController.listBookingsMonth);
router.get("/bookings/export",            requirePermission("export"),   adminController.exportBookings);
router.get("/bookings",                   requirePermission("bookings"), adminController.listBookings);
router.get("/rooms",                      adminController.listRooms);
router.post("/rooms",                     requirePermission("settings"), adminController.createRoom);
router.put("/rooms/:id",                  requirePermission("settings"), adminController.updateRoom);
router.delete("/rooms/:id",               requirePermission("settings"), adminController.deleteRoom);
router.patch("/bookings/:id/cancel",      requirePermission("bookings"), adminController.cancelBookingAdmin);
router.patch("/rooms/:id/calendar",       requirePermission("settings"), adminController.updateRoomCalendar);
router.post("/rooms/:id/create-calendar", requirePermission("settings"), adminController.createRoomCalendar);

// System config
router.get("/config",              requirePermission("settings"), adminController.getConfig);
router.put("/config",              requirePermission("settings"), adminController.updateConfig);
router.post("/config/test-notify", requirePermission("settings"), adminController.testNotifyGroup);
router.get("/calendar/test",       requirePermission("settings"), adminController.testCalendar);

// Allowed Users
router.get("/allowed-users",                    requirePermission("users"), adminController.listAllowedUsers);
router.post("/allowed-users",                   requirePermission("users"), adminController.createAllowedUser);
router.delete("/allowed-users/:id",             requirePermission("users"), adminController.deleteAllowedUser);
router.put("/allowed-users/:id/permissions",    requirePermission("users"), adminController.updateAllowedUserPermissions);

// Audit Logs
router.get("/audit-logs",         requirePermission("audit"), auditController.listAuditLogs);
router.get("/audit-logs/export",  requirePermission("audit"), auditController.exportAuditLogs);
router.get("/audit-logs/actions", requirePermission("audit"), auditController.getAuditActions);

module.exports = router;
