/**
 * BlogScreen — sección Blog de Administración: lista de posts (buscador, estado,
 * scope), acciones por post (retraducir/editar/borrar) y montaje del editor.
 * El editor y los helpers compartidos viven en `blog-editor` y `blog-shared`.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, Text, TextInput, View } from "react-native";
import { styles } from "./BlogScreen.styles";
import { Pencil, Trash2, Plus, Search, Languages } from "lucide-react-native";
import {
  getBlogTaxonomy,
  getBlogPosts,
  deleteBlogPost,
  retranslateBlogPost,
  type BlogPost,
  type BlogCategoryDef,
} from "../api/blog";
import { getMessages, formatMessage, getLocaleTextAlign } from "../i18n";
import { Button } from "../components/ui/Button";
import { type ThemeTokens, type Tab, Badge, ActionIcon, ConfirmModal } from "./blog-shared";
import { BlogEditorModal } from "./blog-editor";

export function BlogSection({
  token,
  language,
  tokens,
}: {
  token: string;
  language: string;
  tokens: ThemeTokens;
}) {
  const t = getMessages(language).blog;
  const textAlign = getLocaleTextAlign(language);

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<BlogCategoryDef[]>([]);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [canManageAll, setCanManageAll] = useState(false);
  const [scopeAll, setScopeAll] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // Editor
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("publish");

  // Confirmaciones de borrado (posts/categorías/tags)
  const [confirm, setConfirm] = useState({
    open: false,
    title: "",
    message: "",
    busy: false,
    action: null as null | (() => Promise<void>),
  });

  const loadTaxonomy = useCallback(async () => {
    try {
      const tax = await getBlogTaxonomy(token);
      setCategories(tax.categories);
      setAiEnabled(tax.aiEnabled);
    } catch {
      setCategories([]);
    }
  }, [token]);

  const loadPosts = useCallback(
    async (scope: boolean) => {
      setBusy(true);
      setError("");
      try {
        const data = await getBlogPosts(token, scope);
        setPosts(data.posts);
        setCanManageAll(data.canManageAll);
      } catch (e) {
        setError(e instanceof Error ? e.message : t.loadError);
      } finally {
        setBusy(false);
      }
    },
    [token, t.loadError],
  );

  useEffect(() => {
    void loadTaxonomy();
  }, [loadTaxonomy]);
  useEffect(() => {
    void loadPosts(scopeAll);
  }, [loadPosts, scopeAll]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((p) =>
      `${p.title} ${p.excerpt} ${p.category ?? ""} ${(p.tags ?? []).join(" ")} ${p.authorName ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [posts, search]);

  const openCreate = () => {
    setEditingId(null);
    setTab("publish");
    setEditorOpen(true);
  };
  const openEdit = (p: BlogPost) => {
    setEditingId(p.id);
    setTab("publish");
    setEditorOpen(true);
  };

  // Feedback efímero de retraducción por post (id → mensaje).
  const [retransMsg, setRetransMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);
  const [retransBusyId, setRetransBusyId] = useState<string | null>(null);

  const onRetranslate = async (p: BlogPost) => {
    setRetransBusyId(p.id);
    setRetransMsg(null);
    try {
      await retranslateBlogPost(p.id, token);
      setRetransMsg({ id: p.id, text: t.retranslateOk, ok: true });
      await loadPosts(scopeAll);
    } catch (e) {
      setRetransMsg({ id: p.id, text: e instanceof Error ? e.message : t.retranslateError, ok: false });
    } finally {
      setRetransBusyId(null);
    }
  };

  const askDeletePost = (p: BlogPost) => {
    setConfirm({
      open: true,
      title: t.postDeleteTitle,
      message: formatMessage(t.postDeleteMessage, { title: p.title }),
      busy: false,
      action: async () => {
        await deleteBlogPost(p.id, token);
        await loadPosts(scopeAll);
      },
    });
  };

  const runConfirm = async () => {
    if (!confirm.action) {
      setConfirm({ open: false, title: "", message: "", busy: false, action: null });
      return;
    }
    setConfirm((c) => ({ ...c, busy: true }));
    try {
      await confirm.action();
      setConfirm({ open: false, title: "", message: "", busy: false, action: null });
    } catch {
      setConfirm((c) => ({ ...c, busy: false }));
    }
  };

  const editingPost = editingId ? posts.find((p) => p.id === editingId) ?? null : null;

  return (
    <View style={styles.sectionRoot}>
      <View style={styles.searchRow}>
        <View style={[styles.searchWrap, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
          <Search size={15} color={tokens.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t.search}
            placeholderTextColor={tokens.textMuted}
            autoCapitalize="none"
            style={[styles.searchInput, { color: tokens.textPrimary, textAlign }]}
          />
        </View>
        <Pressable onPress={openCreate} style={[styles.newBtn, { backgroundColor: tokens.brand }]} accessibilityLabel={t.newPost}>
          <Plus size={20} color="#fff" />
        </Pressable>
      </View>

      {canManageAll ? (
        <View style={styles.scopeRow}>
          <Pressable
            onPress={() => setScopeAll((v) => !v)}
            style={[styles.scopeBtn, { borderColor: tokens.border, backgroundColor: scopeAll ? tokens.brandDim : "transparent" }]}
          >
            <Text style={[styles.scopeText, { color: scopeAll ? tokens.brand : tokens.textMuted }]}>
              {scopeAll ? t.scopeAll : t.scopeMine}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {busy ? (
        <View style={styles.center}><ActivityIndicator color={tokens.brand} /></View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ color: tokens.danger, textAlign, marginBottom: 10 }}>{error}</Text>
          <Button variant="primary" label={t.retry} onPress={() => void loadPosts(scopeAll)} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}><Text style={{ color: tokens.textMuted, textAlign }}>{t.empty}</Text></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: tokens.bgCard, borderColor: tokens.border }]}>
              {item.coverImageUrl ? (
                <Image source={{ uri: item.coverImageUrl }} style={styles.cover} resizeMode="cover" />
              ) : (
                <View style={[styles.cover, styles.coverEmpty, { borderColor: tokens.border }]}>
                  <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{t.noCover}</Text>
                </View>
              )}
              <View style={styles.cardBody}>
                <View style={styles.badgeRow}>
                  <Badge
                    label={item.status === "published" ? t.statusPublished : t.statusDraft}
                    color={item.status === "published" ? tokens.success : tokens.textMuted}
                  />
                  {item.category ? <Badge label={item.category} color={tokens.brand} /> : null}
                </View>
                <Text numberOfLines={2} style={[styles.cardTitle, { color: tokens.textPrimary, textAlign }]}>{item.title}</Text>
                {item.excerpt ? (
                  <Text numberOfLines={2} style={[styles.cardMeta, { color: tokens.textMuted, textAlign }]}>{item.excerpt}</Text>
                ) : null}
                <View style={styles.cardFooter}>
                  <Text style={{ color: tokens.textMuted, fontSize: 12 }}>
                    {formatMessage(t.views, { count: item.viewCount })}
                    {scopeAll && item.authorName ? ` · ${formatMessage(t.byAuthor, { name: item.authorName })}` : ""}
                  </Text>
                  <View style={styles.cardActions}>
                    {item.status === "published" ? (
                      retransBusyId === item.id ? (
                        <View style={styles.actionIcon}><ActivityIndicator size="small" color={tokens.brand} /></View>
                      ) : (
                        <ActionIcon icon={<Languages />} color={tokens.textSecondary} onPress={() => void onRetranslate(item)} />
                      )
                    ) : null}
                    <ActionIcon icon={<Pencil />} color={tokens.brand} onPress={() => openEdit(item)} />
                    <ActionIcon icon={<Trash2 />} color={tokens.danger} onPress={() => askDeletePost(item)} />
                  </View>
                </View>
                {retransMsg && retransMsg.id === item.id ? (
                  <Text style={{ color: retransMsg.ok ? tokens.success : tokens.danger, fontSize: 12, textAlign, marginTop: 2 }}>
                    {retransMsg.text}
                  </Text>
                ) : null}
              </View>
            </View>
          )}
        />
      )}

      <BlogEditorModal
        visible={editorOpen}
        onClose={() => setEditorOpen(false)}
        token={token}
        language={language}
        tokens={tokens}
        tab={tab}
        setTab={setTab}
        post={editingPost}
        categories={categories}
        setCategories={setCategories}
        aiEnabled={aiEnabled}
        onSaved={async () => {
          setEditorOpen(false);
          await loadPosts(scopeAll);
        }}
        askConfirm={(cfg) => setConfirm({ open: true, busy: false, ...cfg })}
      />

      <ConfirmModal
        state={confirm}
        language={language}
        tokens={tokens}
        onCancel={() => setConfirm({ open: false, title: "", message: "", busy: false, action: null })}
        onConfirm={() => void runConfirm()}
      />
    </View>
  );
}

