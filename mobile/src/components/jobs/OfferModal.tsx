import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { Check, Search } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { getLocaleRowDirection, getLocaleTextAlign } from "../../i18n";
import { FormSheet } from "../ui/FormSheet";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import {
  jobsErrorKey,
  listRankedProfessionals,
  searchProfessionalByEmail,
  sendOffers,
  type PublicProfessional,
  type RankedProfessional,
} from "../../api/jobs";
import { jt, type JobsDict } from "./jobs-i18n";
import { makeStyles } from "./OfferModal.styles";

// Enviar oferta a VARIOS profesionales (espejo de `openOfferModal`/`sendOffer`):
// ranking + toggle "solo disponibles" + búsqueda por email + selección múltiple.
export function OfferModal({
  visible,
  token,
  requirementId,
  dict,
  language,
  onClose,
  onSent,
  notify,
}: {
  visible: boolean;
  token: string;
  requirementId: string | null;
  dict: JobsDict;
  language: string;
  onClose: () => void;
  onSent: () => void;
  notify: (msg: string, variant?: "success" | "error") => void;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  const textAlign = getLocaleTextAlign(language);
  const rowDir = getLocaleRowDirection(language);

  const [ranked, setRanked] = useState<RankedProfessional[]>([]);
  const [loadingRanked, setLoadingRanked] = useState(false);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResult, setSearchResult] = useState<PublicProfessional | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible || !requirementId) return;
    setRanked([]); setSearchEmail(""); setSearchResult(null);
    setSelected(new Set()); setMessage(""); setError("");
    void loadRanked(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, requirementId]);

  const loadRanked = async (avail: boolean) => {
    if (!requirementId) return;
    setLoadingRanked(true);
    setError("");
    try {
      setRanked(await listRankedProfessionals(token, requirementId, avail));
    } catch (e) {
      setRanked([]);
      setError(jt(dict, jobsErrorKey(e)));
    } finally {
      setLoadingRanked(false);
    }
  };

  const toggleAvail = (next: boolean) => {
    setOnlyAvailable(next);
    void loadRanked(next);
  };

  const runSearch = async () => {
    const email = searchEmail.trim();
    if (!email) { setSearchResult(null); return; }
    setError("");
    try {
      const p = await searchProfessionalByEmail(token, email);
      setSearchResult(p);
      if (!p) setError(jt(dict, "prof.search.empty"));
    } catch (e) {
      setError(jt(dict, jobsErrorKey(e)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const send = async () => {
    if (!requirementId) return;
    const ids = [...selected];
    if (!ids.length) { setError(jt(dict, "offer.none.selected")); return; }
    setError("");
    setSending(true);
    try {
      const body: { professionalIds: string[]; message?: string } = { professionalIds: ids };
      if (message.trim()) body.message = message.trim();
      const res = await sendOffers(token, requirementId, body);
      notify(jt(dict, "offer.sent.summary", { sent: res.offers.length, skipped: res.skipped.length }), "success");
      onSent();
    } catch (e) {
      setError(jt(dict, jobsErrorKey(e)));
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    if (sending) return;
    onClose();
  };

  return (
    <FormSheet
      visible={visible}
      onClose={handleClose}
      title={jt(dict, "action.offer")}
      language={language}
      scrollable={false}
      fillHeight
      footer={
        <View style={styles.footerRow}>
          <Button label={jt(dict, "cancel")} variant="ghost" onPress={handleClose} disabled={sending} style={styles.footerBtn} />
          <Button label={jt(dict, "offer.sendMany", { n: selected.size })} variant="primary" onPress={send} loading={sending} disabled={selected.size === 0} style={styles.footerBtn} />
        </View>
      }
    >
      <View style={styles.body}>
        <View style={styles.controls}>
          <View style={[styles.searchRow, { flexDirection: rowDir }]}>
            <Input value={searchEmail} onChangeText={setSearchEmail} placeholder={jt(dict, "field.email")} autoCapitalize="none" keyboardType="email-address" style={styles.searchInput} />
            <Button label="" icon={<Search size={16} />} variant="secondary" size="sm" onPress={runSearch} />
          </View>
          <View style={[styles.toggleRow, { flexDirection: rowDir }]}>
            <Text style={[styles.toggleLabel, { color: tokens.textSecondary, textAlign }]}>{jt(dict, "profile.avail.available")}</Text>
            <Switch value={onlyAvailable} onValueChange={toggleAvail} trackColor={{ true: tokens.brand, false: tokens.border }} />
          </View>
          {error ? <Text style={[styles.error, { color: tokens.danger, textAlign }]}>{error}</Text> : null}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {searchResult ? (
            <ProfessionalCard p={searchResult} selected={selected.has(searchResult.customerId)} onToggle={toggleSelect} dict={dict} language={language} tokens={tokens} styles={styles} />
          ) : null}
          {loadingRanked ? (
            <ActivityIndicator color={tokens.brand} style={{ marginTop: 20 }} />
          ) : ranked.length === 0 ? (
            <Text style={[styles.empty, { color: tokens.textMuted }]}>{jt(dict, "prof.search.empty")}</Text>
          ) : (
            ranked.map((p) => (
              <ProfessionalCard key={p.customerId} p={p} score={p.score?.total} testPassed={p.testPassed} selected={selected.has(p.customerId)} onToggle={toggleSelect} dict={dict} language={language} tokens={tokens} styles={styles} />
            ))
          )}
          <View style={{ height: 8 }} />
          <Input label={jt(dict, "offer.message")} value={message} onChangeText={setMessage} multiline />
        </ScrollView>
      </View>
    </FormSheet>
  );
}

function ProfessionalCard({
  p,
  score,
  testPassed,
  selected,
  onToggle,
  dict,
  language,
  tokens,
  styles,
}: {
  p: PublicProfessional;
  score?: number;
  /** Fase 11: aprobó el test del requerimiento (si lo exige). `undefined` = no
   *  aplica (el requerimiento no exige test). */
  testPassed?: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
  dict: JobsDict;
  language: string;
  tokens: ReturnType<typeof getThemeTokens>;
  styles: ReturnType<typeof makeStyles>;
}) {
  const textAlign = getLocaleTextAlign(language);
  const rowDir = getLocaleRowDirection(language);
  const name = p.displayName || p.customerId;
  const availColor = p.availability === "available" ? tokens.success : tokens.warning;
  return (
    <Pressable
      onPress={() => onToggle(p.customerId)}
      style={[styles.profCard, { borderColor: selected ? tokens.brand : tokens.border, backgroundColor: selected ? tokens.brandDim : tokens.bgCard }]}
    >
      <View style={[styles.profHead, { flexDirection: rowDir }]}>
        <Text style={[styles.profName, { color: tokens.textPrimary, textAlign }]} numberOfLines={1}>{name}</Text>
        {selected ? <Check size={18} color={tokens.brand} /> : null}
        <View style={[styles.availBadge, { borderColor: availColor }]}>
          <Text style={[styles.availText, { color: availColor }]}>{jt(dict, `profile.avail.${p.availability}`)}</Text>
        </View>
      </View>
      {p.headline ? <Text style={[styles.headline, { color: tokens.textMuted, textAlign }]} numberOfLines={2}>{p.headline}</Text> : null}
      <View style={styles.chipsRow}>
        {p.country ? <Chip text={p.country} tokens={tokens} styles={styles} /> : null}
        {(p.spokenLanguages || []).map((l, i) => <Chip key={`l${i}`} text={l} tokens={tokens} styles={styles} />)}
        {p.ratingCount > 0 ? <Chip text={`★ ${p.ratingAvg.toFixed(1)} (${p.ratingCount})`} tokens={tokens} styles={styles} /> : null}
        <Chip text={jt(dict, "prof.busyCount", { n: p.activeJobsCount })} tokens={tokens} styles={styles} />
        {typeof score === "number" ? <Chip text={`${jt(dict, "prof.score")}: ${Math.round(score)}`} tokens={tokens} styles={styles} /> : null}
        {/* Fase 11: estado del test del requerimiento (solo si lo exige). */}
        {typeof testPassed === "boolean" ? (
          <View style={[styles.chip, { borderColor: testPassed ? tokens.success : tokens.warning }]}>
            <Text style={[styles.chipText, { color: testPassed ? tokens.success : tokens.warning }]} numberOfLines={1}>
              {jt(dict, testPassed ? "test.passedBadge" : "test.noTestBadge")}
            </Text>
          </View>
        ) : null}
      </View>
      {(p.skills || []).length ? (
        <View style={styles.chipsRow}>
          {p.skills.slice(0, 6).map((s, i) => <Chip key={`s${i}`} text={s} tokens={tokens} styles={styles} />)}
        </View>
      ) : null}
    </Pressable>
  );
}

function Chip({
  text,
  tokens,
  styles,
}: {
  text: string;
  tokens: ReturnType<typeof getThemeTokens>;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.chip}>
      <Text style={[styles.chipText, { color: tokens.textSecondary }]} numberOfLines={1}>{text}</Text>
    </View>
  );
}
