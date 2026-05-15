const prisma = require("../prisma/client");

// ── Categories ────────────────────────────────────────────

async function getActiveCategories() {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
    include: {
      subcategories: {
        where: { isActive: true },
        orderBy: { order: "asc" },
      },
    },
  });
}

async function getAllCategories() {
  return prisma.category.findMany({
    orderBy: { order: "asc" },
    include: {
      subcategories: { orderBy: { order: "asc" } },
    },
  });
}

async function createCategory({ name, icon = "📋", color = "#457b9d" }) {
  const maxOrder = await prisma.category.aggregate({ _max: { order: true } });
  return prisma.category.create({
    data: { name, icon, color, order: (maxOrder._max.order || 0) + 1 },
  });
}

async function updateCategory(id, data) {
  return prisma.category.update({ where: { id: Number(id) }, data });
}

async function deleteCategory(id) {
  return prisma.category.delete({ where: { id: Number(id) } });
}

// ── Subcategories ─────────────────────────────────────────

async function createSubcategory(categoryId, name) {
  const maxOrder = await prisma.subcategory.aggregate({
    where: { categoryId: Number(categoryId) },
    _max: { order: true },
  });
  return prisma.subcategory.create({
    data: { name, categoryId: Number(categoryId), order: (maxOrder._max.order || 0) + 1 },
  });
}

async function updateSubcategory(id, data) {
  return prisma.subcategory.update({ where: { id: Number(id) }, data });
}

async function deleteSubcategory(id) {
  return prisma.subcategory.delete({ where: { id: Number(id) } });
}

// ── FAQ ───────────────────────────────────────────────────

async function getActiveFaqs() {
  return prisma.faqItem.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
  });
}

async function getAllFaqs() {
  return prisma.faqItem.findMany({ orderBy: { order: "asc" } });
}

async function createFaq({ question, answer }) {
  const maxOrder = await prisma.faqItem.aggregate({ _max: { order: true } });
  return prisma.faqItem.create({
    data: { question, answer, order: (maxOrder._max.order || 0) + 1 },
  });
}

async function updateFaq(id, data) {
  return prisma.faqItem.update({ where: { id: Number(id) }, data });
}

async function deleteFaq(id) {
  return prisma.faqItem.delete({ where: { id: Number(id) } });
}

async function getFaqById(id) {
  return prisma.faqItem.findUnique({ where: { id: Number(id) } });
}

async function incrementFaqViews(ids) {
  if (!ids || !ids.length) return;
  return prisma.faqItem.updateMany({
    where: { id: { in: ids } },
    data: { viewCount: { increment: 1 } },
  });
}

async function incrementFaqResolved(id) {
  return prisma.faqItem.update({
    where: { id: Number(id) },
    data: { resolvedCount: { increment: 1 } },
  });
}

module.exports = {
  getActiveCategories, getAllCategories, createCategory, updateCategory, deleteCategory,
  createSubcategory, updateSubcategory, deleteSubcategory,
  getActiveFaqs, getAllFaqs, createFaq, updateFaq, deleteFaq, getFaqById,
  incrementFaqViews, incrementFaqResolved,
};
