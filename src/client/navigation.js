// Sidebar groups and vector icons from the supplied CHIFAA draft. No draft scripts run.
const NAV_SECTIONS = [
  [
    "catalogs",
    "DANH MỤC",
    "dashboard",
    [
      "catalog",
      "stores",
      "dishes",
      "employees",
      "discounts"
    ]
  ],
  [
    "warehouse",
    "KHO & TỒN KHO",
    "inventory",
    [
      "inventory",
      "stockmovements",
      "stockhistory",
      "kiosk",
      "reorder"
    ]
  ],
  [
    "recipes",
    "CÔNG THỨC",
    "recipes",
    [
      "recipes",
      "batches",
      "rice",
      "packaging",
      "cost"
    ]
  ],
  [
    "production",
    "SẢN XUẤT & NGUYÊN LIỆU",
    "production",
    [
      "production",
      "demand",
      "audit",
      "variance",
      "consumption"
    ]
  ],
  [
    "entry",
    "NHẬP LIỆU",
    "audit",
    [
      "entry",
      "entry-stock",
      "entry-sales",
      "entry-attendance",
      "entry-production",
      "entry-plans",
      "entry-loans",
      "entry-debts",
      "entry-cash",
      "entry-payroll",
      "assets"
    ]
  ],
  [
    "customers",
    "KHÁCH HÀNG",
    "stores",
    [
      "orders"
    ]
  ],
  [
    "system",
    "QUẢN TRỊ HỆ THỐNG",
    "employees",
    [
      "admin",
      "health"
    ]
  ]
];
const NAV_ICONS = {"dashboard":[["rect",{"x":"3","y":"3","width":"7","height":"7","rx":"1"}],["rect",{"x":"14","y":"3","width":"7","height":"7","rx":"1"}],["rect",{"x":"3","y":"14","width":"7","height":"7","rx":"1"}],["rect",{"x":"14","y":"14","width":"7","height":"7","rx":"1"}]],"opsdashboard":[["path",{"d":"M4 20V13m5 7V8m5 12v-5m5 5V4"}]],"strategy":[["path",{"d":"M4 19h16M5 16V9m5 7V5m5 11v-4m5 4V8"}],["path",{"d":"m4 7 5-3 5 4 6-5"}]],"catalog":[["path",{"d":"m12 2 9 5-9 5-9-5 9-5Zm-9 5v10l9 5 9-5V7M12 12v10"}]],"stores":[["path",{"d":"M3 10V5h18v5l-2 3H5l-2-3Zm2 3v8h14v-8M9 21v-6h6v6"}]],"dishes":[["path",{"d":"M4 3v8m3-8v8m3-8v8M7 11v10M17 3c-3 4-3 9 0 10v8M3 3h8"}]],"employees":[["circle",{"cx":"9","cy":"8","r":"3"}],["path",{"d":"M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 5v1"}]],"discounts":[["circle",{"cx":"6","cy":"6","r":"2"}],["circle",{"cx":"18","cy":"18","r":"2"}],["path",{"d":"m4 20 16-16"}]],"inventory":[["rect",{"x":"3","y":"4","width":"8","height":"8","rx":"1"}],["rect",{"x":"13","y":"4","width":"8","height":"8","rx":"1"}],["rect",{"x":"8","y":"13","width":"8","height":"8","rx":"1"}]],"stockmovements":[["path",{"d":"M4 7h16l-4-4m4 4-4 4M20 17H4l4-4m-4 4 4 4"}]],"stockhistory":[["circle",{"cx":"12","cy":"12","r":"9"}],["path",{"d":"M12 7v5l4 3"}]],"reorder":[["path",{"d":"M12 3 2 21h20L12 3Zm0 6v5m0 4h.01"}]],"recipes":[["path",{"d":"M4 3h14a2 2 0 0 1 2 2v16H6a2 2 0 0 1-2-2V3Zm0 14h16M8 7h8M8 11h5"}]],"batches":[["path",{"d":"M9 2h6M10 2v7l-6 10a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3L14 9V2M7 15h10"}]],"rice":[["path",{"d":"M4 3v8m3-8v8m3-8v8M7 11v10M17 3c-3 4-3 9 0 10v8M3 3h8"}]],"packaging":[["path",{"d":"m12 2 9 5-9 5-9-5 9-5Zm-9 5v10l9 5 9-5V7M12 12v10"}]],"cost":[["path",{"d":"M4 20V13m5 7V8m5 12v-5m5 5V4"}]],"production":[["path",{"d":"M3 21V10l6 4v-4l6 4V5h6v16H3Zm12-14h6M7 18h2m3 0h2m3 0h2"}]],"demand":[["path",{"d":"M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1"}]],"audit":[["rect",{"x":"4","y":"5","width":"16","height":"17","rx":"2"}],["path",{"d":"M9 3h6v4H9zM8 12h8M8 16h6"}]],"variance":[["path",{"d":"M4 20V13m5 7V8m5 12v-5m5 5V4"}]],"consumption":[["path",{"d":"M9 2h6M10 2v7l-6 10a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3L14 9V2M7 15h10"}]],"entry":[["rect",{"x":"3","y":"3","width":"7","height":"7","rx":"1"}],["rect",{"x":"14","y":"3","width":"7","height":"7","rx":"1"}],["rect",{"x":"3","y":"14","width":"7","height":"7","rx":"1"}],["rect",{"x":"14","y":"14","width":"7","height":"7","rx":"1"}]],"entry-stock":[["rect",{"x":"4","y":"5","width":"16","height":"17","rx":"2"}],["path",{"d":"M9 3h6v4H9zM8 12h8M8 16h6"}]],"entry-sales":[["path",{"d":"M4 20V13m5 7V8m5 12v-5m5 5V4"}]],"entry-attendance":[["circle",{"cx":"12","cy":"12","r":"9"}],["path",{"d":"M12 7v5l4 3"}]],"entry-production":[["path",{"d":"M3 21V10l6 4v-4l6 4V5h6v16H3Zm12-14h6M7 18h2m3 0h2m3 0h2"}]],"entry-plans":[["circle",{"cx":"12","cy":"12","r":"9"}],["circle",{"cx":"12","cy":"12","r":"5"}],["circle",{"cx":"12","cy":"12","r":"1"}]],"entry-loans":[["rect",{"x":"3","y":"6","width":"18","height":"15","rx":"2"}],["path",{"d":"M3 10h18M5 6V4h13M16 15h2"}]],"entry-debts":[["path",{"d":"M4 7h16l-4-4m4 4-4 4M20 17H4l4-4m-4 4 4 4"}]],"entry-cash":[["rect",{"x":"3","y":"6","width":"18","height":"15","rx":"2"}],["path",{"d":"M3 10h18M5 6V4h13M16 15h2"}]]};
export { NAV_SECTIONS, NAV_ICONS };
