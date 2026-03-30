const express = require("express");
const adminController = require("../controllers/adminController");

const router = express.Router();

function adminAuth(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (token !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
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
router.get("/bookings",                       adminController.listBookings);
router.get("/rooms",                          adminController.listRooms);
router.patch("/bookings/:id/cancel",          adminController.cancelBookingAdmin);
router.patch("/rooms/:id/calendar",           adminController.updateRoomCalendar);

module.exports = router;
