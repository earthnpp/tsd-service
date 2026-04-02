const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN || "";

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": ADMIN_TOKEN,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export const api = {
  // Tickets
  getTickets: (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "" && v !== "all") q.set(k, v); });
    return request(`/tickets?${q}`);
  },
  exportTickets: (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "" && v !== "all") q.set(k, v); });
    return request(`/tickets/export?${q}`);
  },
  getTicket: (id) => request(`/tickets/${id}`),
  assignTicket: (id, assignee) => request(`/tickets/${id}/assign`, { method: "PATCH", body: JSON.stringify({ assignee }) }),
  closeTicket: (id, resolution) => request(`/tickets/${id}/close`, { method: "PATCH", body: JSON.stringify({ resolution }) }),
  updateTicketStatus: (id, data) => request(`/tickets/${id}/status`, { method: "PATCH", body: JSON.stringify(data) }),
  updateTicketCost: (id, data) => request(`/tickets/${id}/cost`, { method: "PATCH", body: JSON.stringify(data) }),
  closeWithCost: (id, data) => request(`/tickets/${id}/close-cost`, { method: "PATCH", body: JSON.stringify(data) }),
  getStats: (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, v); });
    const qs = q.toString();
    return request(`/stats${qs ? "?" + qs : ""}`);
  },

  // Assignees
  getAssignees: () => request("/assignees"),
  createAssignee: (name) => request("/assignees", { method: "POST", body: JSON.stringify({ name }) }),
  updateAssignee: (id, data) => request(`/assignees/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteAssignee: (id) => request(`/assignees/${id}`, { method: "DELETE" }),

  // Categories
  getCategories: () => request("/categories"),
  createCategory: (data) => request("/categories", { method: "POST", body: JSON.stringify(data) }),
  updateCategory: (id, data) => request(`/categories/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCategory: (id) => request(`/categories/${id}`, { method: "DELETE" }),
  createSubcategory: (catId, name) => request(`/categories/${catId}/subcategories`, { method: "POST", body: JSON.stringify({ name }) }),
  updateSubcategory: (id, data) => request(`/subcategories/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteSubcategory: (id) => request(`/subcategories/${id}`, { method: "DELETE" }),

  // FAQ
  getFaqs: () => request("/faq"),
  createFaq: (data) => request("/faq", { method: "POST", body: JSON.stringify(data) }),
  updateFaq: (id, data) => request(`/faq/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteFaq: (id) => request(`/faq/${id}`, { method: "DELETE" }),

  // Bookings
  getBookings: (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "" && v !== "all") q.set(k, v); });
    return request(`/bookings?${q}`);
  },
  getRooms: () => request("/rooms"),
  createRoom: (name) => request("/rooms", { method: "POST", body: JSON.stringify({ name }) }),
  updateRoom: (id, data) => request(`/rooms/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteRoom: (id) => request(`/rooms/${id}`, { method: "DELETE" }),
  cancelBooking: (id) => request(`/bookings/${id}/cancel`, { method: "PATCH" }),
  updateRoomCalendar: (id, calendarId) => request(`/rooms/${id}/calendar`, { method: "PATCH", body: JSON.stringify({ calendarId }) }),
};
