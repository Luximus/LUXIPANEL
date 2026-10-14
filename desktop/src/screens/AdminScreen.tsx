import { useCallback, useEffect, useState } from "react";
import { Users, Shield, Package, Boxes, FileText, RefreshCw, Plus, Eye } from "lucide-react";
import DataTable from "../components/DataTable";
import { NavActions } from "../components/NavActions";
import { AdminUserModal } from "../components/admin/AdminUserModal";
import { AdminRoleModal } from "../components/admin/AdminRoleModal";
import { AdminProductModal } from "../components/admin/AdminProductModal";
import { AdminModuleModal } from "../components/admin/AdminModuleModal";
import { AdminBlogModal } from "../components/admin/AdminBlogModal";
import { useDialog } from "../hooks/useDialog";
import { useToast } from "../components/ToastProvider";
import { useEnterAnimation } from "../hooks/useEnterAnimation";
import { formatMessage, getMessages } from "../i18n";
import type { NavAction } from "../features/app/types";
import {
  getAdminUsers, getAdminRolesSummary, setAdminUserBlocked, deleteAdminUser,
  getAdminRoles, deleteAdminRole,
  getWompiProducts, deleteWompiProduct,
  getPremiumModules, deletePremiumModule,
  type AdminUser, type AdminRoleSummary, type AdminRole, type PermissionDef,
  type WompiProduct, type PremiumModule,
} from "../api/admin";
import {
  getBlogTaxonomy, getBlogPosts, deleteBlogPost, retranslateBlogPost,
  type BlogPost, type BlogCategory,
} from "../api/blog";

type AdminTab = "users" | "roles" | "products" | "modules" | "blog";

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

export function AdminScreen({
  language,
  token,
}: {
  language: string;
  token: string;
}) {
  const t = getMessages(language);
  const a = t.admin;
  const bl = t.blog;
  const dialog = useDialog(language);
  const toast = useToast();
  const [tab, setTab] = useState<AdminTab>("users");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Datos por superficie.
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [rolesSummary, setRolesSummary] = useState<AdminRoleSummary[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [permissions, setPermissions] = useState<PermissionDef[]>([]);
  const [products, setProducts] = useState<WompiProduct[]>([]);
  const [modules, setModules] = useState<PremiumModule[]>([]);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [blogCategories, setBlogCategories] = useState<BlogCategory[]>([]);
  const [blogAiEnabled, setBlogAiEnabled] = useState(false);
  const [blogCanManageAll, setBlogCanManageAll] = useState(false);
  const [blogScopeAll, setBlogScopeAll] = useState(false);

  // Modales (estado de edición).
  const [userModal, setUserModal] = useState<AdminUser | null>(null);
  const [roleModal, setRoleModal] = useState<{ open: boolean; role: AdminRole | null }>({ open: false, role: null });
  const [productModal, setProductModal] = useState<{ open: boolean; product: WompiProduct | null }>({ open: false, product: null });
  const [moduleModal, setModuleModal] = useState<{ open: boolean; module: PremiumModule | null }>({ open: false, module: null });
  const [blogModal, setBlogModal] = useState<{ open: boolean; post: BlogPost | null }>({ open: false, post: null });

  const loadTab = useCallback(async (which: AdminTab) => {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      if (which === "users") {
        const [u, r] = await Promise.all([getAdminUsers(token), getAdminRolesSummary(token)]);
        setUsers(u);
        setRolesSummary(r);
      } else if (which === "roles") {
        const { roles: rs, permissions: ps } = await getAdminRoles(token);
        setRoles(rs);
        setPermissions(ps);
      } else if (which === "products") {
        setProducts(await getWompiProducts(token));
      } else if (which === "modules") {
        setModules(await getPremiumModules(token));
      } else if (which === "blog") {
        const [tax, list] = await Promise.all([
          getBlogTaxonomy(token),
          getBlogPosts(token, blogScopeAll),
        ]);
        setBlogCategories(tax.categories);
        setBlogAiEnabled(tax.aiEnabled);
        setPosts(list.posts);
        setBlogCanManageAll(list.canManageAll);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : a.loadError);
    } finally {
      setBusy(false);
    }
  }, [token, a.loadError, blogScopeAll]);

  useEffect(() => {
    void loadTab(tab);
  }, [tab, loadTab]);

  // Acciones contextuales (antes publicadas al navbar superior, ya removido):
  // ahora se renderizan a la derecha de la fila de tabs (ver `<NavActions>`).
  // Actualizar siempre; "Crear" en roles/productos/módulos (los usuarios solo se
  // editan, no se crean desde aquí, igual que el web).
  const adminActions: NavAction[] = [
    { id: "refresh", label: a.refresh, icon: <RefreshCw size={16} />, onClick: () => void loadTab(tab), disabled: busy, busy },
  ];
  if (tab === "roles") adminActions.push({ id: "new", label: a.newRole, icon: <Plus size={16} />, variant: "primary", onClick: () => setRoleModal({ open: true, role: null }) });
  if (tab === "products") adminActions.push({ id: "new", label: a.newProduct, icon: <Plus size={16} />, variant: "primary", onClick: () => setProductModal({ open: true, product: null }) });
  if (tab === "modules") adminActions.push({ id: "new", label: a.newModule, icon: <Plus size={16} />, variant: "primary", onClick: () => setModuleModal({ open: true, module: null }) });
  if (tab === "blog") {
    if (blogCanManageAll) {
      adminActions.push({
        id: "scope",
        label: blogScopeAll ? bl.scopeAll : bl.scopeMine,
        icon: <Eye size={16} />,
        onClick: () => setBlogScopeAll((v) => !v),
        disabled: busy,
      });
    }
    adminActions.push({ id: "new", label: bl.newPost, icon: <Plus size={16} />, variant: "primary", onClick: () => setBlogModal({ open: true, post: null }) });
  }

  const animationRef = useEnterAnimation<HTMLElement>([
    { selector: ".panel-hero", from: { opacity: 0, y: 18 }, duration: 0.5 },
    { selector: ".panel-section", from: { opacity: 0, y: 16 }, duration: 0.5, delay: "<0.1" },
  ]);

  // ── Acciones de fila por superficie ─────────────────────────────────
  const onUserAction = useCallback(async (actionId: string, row: Record<string, unknown>) => {
    const user = users.find((u) => u.id === row.id);
    if (!user) return;
    try {
      if (actionId === "edit") { setUserModal(user); return; }
      if (actionId === "toggle_block") {
        const next = !user.blocked;
        const ok = await dialog.confirm({
          title: next ? a.blockTitle : a.unblockTitle,
          message: formatMessage(next ? a.blockConfirm : a.unblockConfirm, { email: user.email }),
          tone: next ? "danger" : "default",
          confirmLabel: next ? a.actionBlock : a.actionUnblock,
        });
        if (!ok) return;
        await setAdminUserBlocked(user.id, next, token);
        await loadTab("users");
        toast.success(t.toast.saved);
        return;
      }
      if (actionId === "delete") {
        const ok = await dialog.confirm({
          title: a.deleteUserTitle,
          message: formatMessage(a.deleteUserConfirm, { email: user.email }),
          tone: "danger",
          confirmLabel: a.delete,
        });
        if (!ok) return;
        await deleteAdminUser(user.id, token);
        await loadTab("users");
        toast.success(t.toast.deleted);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : a.actionError);
    }
  }, [users, token, dialog, toast, a, t, loadTab]);

  const onRoleAction = useCallback(async (actionId: string, row: Record<string, unknown>) => {
    const role = roles.find((r) => r.id === row.id);
    if (!role) return;
    try {
      if (actionId === "edit") { setRoleModal({ open: true, role }); return; }
      if (actionId === "delete") {
        if (role.isSystem) {
          await dialog.alert({ title: a.actionNotAllowed, message: a.systemRolesCannotDelete });
          return;
        }
        const ok = await dialog.confirm({
          title: a.deleteRoleTitle,
          message: formatMessage(a.deleteRoleConfirm, { name: role.name }),
          tone: "danger",
          confirmLabel: a.delete,
        });
        if (!ok) return;
        await deleteAdminRole(role.id, token);
        await loadTab("roles");
        toast.success(t.toast.deleted);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : a.actionError);
    }
  }, [roles, token, dialog, toast, a, t, loadTab]);

  const onProductAction = useCallback(async (actionId: string, row: Record<string, unknown>) => {
    const product = products.find((p) => p.id === row.id);
    if (!product) return;
    try {
      if (actionId === "edit") { setProductModal({ open: true, product }); return; }
      if (actionId === "delete") {
        const ok = await dialog.confirm({
          title: a.deleteProductTitle,
          message: formatMessage(a.deleteProductConfirm, { name: product.name }),
          tone: "danger",
          confirmLabel: a.delete,
        });
        if (!ok) return;
        await deleteWompiProduct(product.id, token);
        await loadTab("products");
        toast.success(t.toast.deleted);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : a.actionError);
    }
  }, [products, token, dialog, toast, a, t, loadTab]);

  const onModuleAction = useCallback(async (actionId: string, row: Record<string, unknown>) => {
    const mod = modules.find((m) => m.id === row.id);
    if (!mod) return;
    try {
      if (actionId === "edit") { setModuleModal({ open: true, module: mod }); return; }
      if (actionId === "delete") {
        const ok = await dialog.confirm({
          title: a.deleteModuleTitle,
          message: formatMessage(a.deleteModuleConfirm, { code: mod.code }),
          tone: "danger",
          confirmLabel: a.delete,
        });
        if (!ok) return;
        await deletePremiumModule(mod.id, token);
        await loadTab("modules");
        toast.success(t.toast.deleted);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : a.actionError);
    }
  }, [modules, token, dialog, toast, a, t, loadTab]);

  const onBlogAction = useCallback(async (actionId: string, row: Record<string, unknown>) => {
    const blogPost = posts.find((p) => p.id === row.id);
    if (!blogPost) return;
    try {
      if (actionId === "edit") { setBlogModal({ open: true, post: blogPost }); return; }
      if (actionId === "view") {
        if (blogPost.status === "published" && blogPost.slug) {
          window.open(`https://luxisoft.com/blog/${encodeURIComponent(blogPost.slug)}`, "_blank", "noopener");
        }
        return;
      }
      if (actionId === "retranslate") {
        if (blogPost.status !== "published") return;
        await retranslateBlogPost(blogPost.id, token);
        toast.info(bl.retranslateStarted);
        await loadTab("blog");
        return;
      }
      if (actionId === "delete") {
        const ok = await dialog.confirm({
          title: bl.deletePostTitle,
          message: formatMessage(bl.deletePostConfirm, { title: blogPost.title }),
          tone: "danger",
          confirmLabel: bl.delete,
        });
        if (!ok) return;
        await deleteBlogPost(blogPost.id, token);
        await loadTab("blog");
        toast.success(t.toast.deleted);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : bl.actionError);
    }
  }, [posts, token, dialog, toast, bl, t, loadTab]);

  // ── Filas ────────────────────────────────────────────────────────────
  const userRows = users.map((u) => ({
    id: u.id,
    name: u.name || "—",
    email: u.email,
    role: u.role ?? "user",
    status: u.blocked ? a.statusBlocked : a.statusActive,
    company: u.company ?? "—",
    country: u.country ?? "—",
    products: (u.activeProductNames ?? []).join(", ") || "—",
    created: fmtDate(u.createdAt),
  }));

  const usdFmt = new Intl.NumberFormat(language.startsWith("es") ? "es-CO" : language, { style: "currency", currency: "USD", minimumFractionDigits: 2 });
  const copFmt = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
  const intFmt = new Intl.NumberFormat(language.startsWith("es") ? "es-CO" : language);

  // Campos `_*` crudos: la celda muestra el string formateado, pero la fila de
  // totales suma estos números (evita reparsear el texto, que en locales con
  // "." decimal daría magnitudes erróneas).
  const roleRows = roles.map((r) => ({
    id: r.id,
    name: r.name,
    key: r.key,
    description: r.description ?? "—",
    permissions: String(r.permissions.length),
    users: String(r.userCount),
    _permissions: r.permissions.length,
    _users: r.userCount,
    type: r.isSystem ? a.typeSystem : a.typeCustom,
    created: fmtDate(r.createdAt),
  }));

  const productRows = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    priceUsd: p.amountCop === 0 ? a.freeLabel : (typeof p.amountUsd === "number" ? usdFmt.format(p.amountUsd) : "—"),
    priceCop: copFmt.format(p.amountCop || 0),
    _priceUsd: typeof p.amountUsd === "number" ? p.amountUsd : 0,
    _priceCop: p.amountCop || 0,
    validity: p.validityMonths <= 0 ? a.validityNoExpiration : String(p.validityMonths),
    status: p.isActive ? a.active : a.inactive,
    visible: p.showInDesktop !== false ? a.yes : a.no,
  }));

  const moduleRows = modules.map((m) => ({
    id: m.id,
    code: m.code,
    name: m.name,
    category: m.category || "—",
    kind: m.kind === "mcp_server" ? a.kindMcp : a.kindModule,
    tag: m.tag === "premium" ? a.tagPremium : a.tagFree,
    version: m.version ?? "—",
    cost: "—",
    _cost: 0,
    status: m.status === "disabled" ? a.statusDisabled : a.statusEnabled,
  }));

  const blogRows = posts.map((p) => ({
    id: p.id,
    title: p.title || "—",
    category: p.category ?? "—",
    // Estado crudo (no traducido) para el predicado `visible` de las acciones.
    _status: p.status,
    status: p.status === "published" ? bl.statusPublished : bl.statusDraft,
    tags: (p.tags ?? []).join(", ") || "—",
    author: p.authorName ?? "—",
    views: String(p.viewCount ?? 0),
    _views: p.viewCount ?? 0,
    date: fmtDate(p.publishedAt ?? p.updatedAt),
  }));

  const rowActions = [
    { id: "edit", label: a.edit },
    { id: "delete", label: a.delete, variant: "danger" as const },
  ];

  const tabs: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
    { id: "users", label: a.tabUsers, icon: <Users size={15} /> },
    { id: "roles", label: a.tabRoles, icon: <Shield size={15} /> },
    { id: "products", label: a.tabProducts, icon: <Package size={15} /> },
    { id: "modules", label: a.tabModules, icon: <Boxes size={15} /> },
    { id: "blog", label: bl.tab, icon: <FileText size={15} /> },
  ];

  const titleByTab: Record<AdminTab, string> = { users: a.usersTitle, roles: a.rolesTitle, products: a.productsTitle, modules: a.modulesTitle, blog: bl.title };
  const subtitleByTab: Record<AdminTab, string> = { users: a.usersSubtitle, roles: a.rolesSubtitle, products: a.productsSubtitle, modules: a.modulesSubtitle, blog: bl.subtitle };

  return (
    <main ref={animationRef} className="h-full w-full overflow-y-auto p-3 sm:p-4 md:p-6">
      <div className="panel-wrapper">
        <section className="panel-hero">
          <div className="panel-hero__grid">
            <div className="panel-hero__content">
              <span className="panel-hero__eyebrow">{a.section}</span>
              <h1 className="panel-hero__title">{titleByTab[tab]}</h1>
              <p className="panel-hero__subtitle">{subtitleByTab[tab]}</p>
            </div>
          </div>
        </section>

        <section className="panel-section">
          <div className="support-section">
            <div className="support-section__header">
              <div className="flex flex-wrap gap-2">
                {tabs.map((tb) => (
                  <button
                    key={tb.id}
                    type="button"
                    className={`btn btn-sm lp-seg-tab ${tab === tb.id ? "is-active" : "btn-outline"}`}
                    onClick={() => setTab(tb.id)}
                  >
                    {tb.icon} {tb.label}
                  </button>
                ))}
              </div>
              <NavActions actions={adminActions} />
            </div>

            {error ? (
              <div className="mt-3 flex items-center gap-3">
                <p className="text-sm text-error">{error}</p>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => void loadTab(tab)}>{a.refresh}</button>
              </div>
            ) : null}

            <div className="mt-3">
              {tab === "users" ? (
                <DataTable
                  tableId="admin-users-table"
                  title={a.usersTitle}
                  data={userRows}
                  columns={[
                    { id: "name", header: a.colName, accessorKey: "name", sortable: true },
                    { id: "email", header: a.colEmail, accessorKey: "email", sortable: true },
                    { id: "role", header: a.colRole, accessorKey: "role", sortable: true },
                    { id: "status", header: a.colStatus, accessorKey: "status", sortable: true },
                    { id: "company", header: a.colCompany, accessorKey: "company" },
                    { id: "country", header: a.colCountry, accessorKey: "country" },
                    { id: "products", header: a.colProducts, accessorKey: "products" },
                    { id: "created", header: a.colCreated, accessorKey: "created", sortable: true },
                  ]}
                  rowActions={[
                    { id: "edit", label: a.editUser },
                    { id: "toggle_block", label: a.actionBlock },
                    { id: "delete", label: a.delete, variant: "danger" },
                  ]}
                  pageSizeOptions={[10, 25, 50]}
                  language={language}
                  loading={busy}
                  onRowAction={(id, row) => void onUserAction(id, row)}
                />
              ) : null}

              {tab === "roles" ? (
                <DataTable
                  tableId="admin-roles-table"
                  title={a.rolesTitle}
                  data={roleRows}
                  columns={[
                    { id: "name", header: a.colName, accessorKey: "name", sortable: true },
                    { id: "key", header: a.colKey, accessorKey: "key", sortable: true },
                    { id: "description", header: a.colDescription, accessorKey: "description" },
                    { id: "permissions", header: a.colPermissions, accessorKey: "permissions", sortable: true, summary: { value: (r) => r._permissions, format: (n) => intFmt.format(n) } },
                    { id: "users", header: a.colUsers, accessorKey: "users", sortable: true, summary: { value: (r) => r._users, format: (n) => intFmt.format(n) } },
                    { id: "type", header: a.colType, accessorKey: "type", sortable: true },
                    { id: "created", header: a.colCreated, accessorKey: "created", sortable: true },
                  ]}
                  rowActions={rowActions}
                  pageSizeOptions={[10, 25, 50]}
                  language={language}
                  loading={busy}
                  onRowAction={(id, row) => void onRoleAction(id, row)}
                />
              ) : null}

              {tab === "products" ? (
                <DataTable
                  tableId="admin-products-table"
                  title={a.productsTitle}
                  data={productRows}
                  columns={[
                    { id: "name", header: a.colProduct, accessorKey: "name", sortable: true },
                    { id: "sku", header: a.colSku, accessorKey: "sku", sortable: true },
                    { id: "priceUsd", header: a.colPriceUsd, accessorKey: "priceUsd", sortable: true, summary: { value: (r) => r._priceUsd, format: (n) => usdFmt.format(n) } },
                    { id: "priceCop", header: a.colPriceCop, accessorKey: "priceCop", summary: { value: (r) => r._priceCop, format: (n) => copFmt.format(n) } },
                    { id: "validity", header: a.colValidity, accessorKey: "validity" },
                    { id: "status", header: a.colStatus, accessorKey: "status", sortable: true },
                    { id: "visible", header: a.colVisible, accessorKey: "visible" },
                  ]}
                  rowActions={rowActions}
                  pageSizeOptions={[10, 25, 50]}
                  language={language}
                  loading={busy}
                  onRowAction={(id, row) => void onProductAction(id, row)}
                />
              ) : null}

              {tab === "modules" ? (
                <DataTable
                  tableId="admin-modules-table"
                  title={a.modulesTitle}
                  data={moduleRows}
                  columns={[
                    { id: "code", header: a.colCode, accessorKey: "code", sortable: true },
                    { id: "name", header: a.colName, accessorKey: "name", sortable: true },
                    { id: "category", header: a.colCategory, accessorKey: "category", sortable: true },
                    { id: "kind", header: a.colKind, accessorKey: "kind", sortable: true },
                    { id: "tag", header: a.colTag, accessorKey: "tag", sortable: true },
                    { id: "version", header: a.colVersion, accessorKey: "version" },
                    { id: "cost", header: a.colCost, accessorKey: "cost", sortable: true, summary: { value: (r) => r._cost, format: (n) => intFmt.format(n) } },
                    { id: "status", header: a.colStatus, accessorKey: "status", sortable: true },
                  ]}
                  rowActions={rowActions}
                  pageSizeOptions={[10, 25, 50]}
                  language={language}
                  loading={busy}
                  onRowAction={(id, row) => void onModuleAction(id, row)}
                />
              ) : null}

              {tab === "blog" ? (
                <DataTable
                  tableId="admin-blog-table"
                  title={bl.title}
                  data={blogRows}
                  columns={[
                    { id: "title", header: bl.colTitle, accessorKey: "title", sortable: true },
                    { id: "category", header: bl.colCategory, accessorKey: "category", sortable: true },
                    { id: "status", header: bl.colStatus, accessorKey: "status", sortable: true },
                    { id: "tags", header: bl.colTags, accessorKey: "tags" },
                    { id: "author", header: bl.colAuthor, accessorKey: "author", sortable: true },
                    { id: "views", header: bl.colViews, accessorKey: "views", sortable: true, summary: { value: (r) => r._views, format: (n) => intFmt.format(n) } },
                    { id: "date", header: bl.colDate, accessorKey: "date", sortable: true },
                  ]}
                  rowActions={[
                    { id: "edit", label: bl.edit },
                    { id: "view", label: bl.viewPublic },
                    { id: "retranslate", label: bl.retranslate, visible: (row) => row._status === "published" },
                    { id: "delete", label: bl.delete, variant: "danger" },
                  ]}
                  pageSizeOptions={[10, 25, 50]}
                  language={language}
                  loading={busy}
                  onRowAction={(id, row) => void onBlogAction(id, row)}
                />
              ) : null}
            </div>
          </div>
        </section>
      </div>

      <AdminUserModal
        user={userModal}
        roles={rolesSummary}
        token={token}
        language={language}
        onClose={() => setUserModal(null)}
        onSaved={() => { setUserModal(null); void loadTab("users"); toast.success(t.toast.saved); }}
      />
      <AdminRoleModal
        open={roleModal.open}
        role={roleModal.role}
        permissions={permissions}
        token={token}
        language={language}
        onClose={() => setRoleModal({ open: false, role: null })}
        onSaved={() => { setRoleModal({ open: false, role: null }); void loadTab("roles"); toast.success(t.toast.saved); }}
      />
      <AdminProductModal
        open={productModal.open}
        product={productModal.product}
        token={token}
        language={language}
        onClose={() => setProductModal({ open: false, product: null })}
        onSaved={() => { setProductModal({ open: false, product: null }); void loadTab("products"); toast.success(t.toast.saved); }}
      />
      <AdminModuleModal
        open={moduleModal.open}
        module={moduleModal.module}
        token={token}
        language={language}
        onClose={() => setModuleModal({ open: false, module: null })}
        onSaved={() => { setModuleModal({ open: false, module: null }); void loadTab("modules"); toast.success(t.toast.saved); }}
      />
      <AdminBlogModal
        open={blogModal.open}
        post={blogModal.post}
        categories={blogCategories}
        aiEnabled={blogAiEnabled}
        token={token}
        language={language}
        dialog={dialog}
        onClose={() => setBlogModal({ open: false, post: null })}
        onSaved={() => { setBlogModal({ open: false, post: null }); void loadTab("blog"); toast.success(t.toast.saved); }}
        onTaxonomyChange={(next) => setBlogCategories(next)}
      />

      {dialog.element}
    </main>
  );
}
