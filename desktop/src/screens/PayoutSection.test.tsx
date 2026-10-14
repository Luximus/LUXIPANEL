import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { getMessages } from "../i18n";
import type { PayoutConfig, PayoutMethodDTO, PayoutRequestDTO } from "../api/payouts";

// ── Mock de la capa de API de payouts ─────────────────────────────────────
// Los getters devuelven promesas controlables por cada caso; los mutadores
// son vi.fn() (no se ejercitan aquí). `quoteTokensToUsd` se conserva con una
// impl real-ish (t*r) para que el conversor/balance rinda números coherentes.
vi.mock("../api/payouts", () => ({
  getPayoutConfig: vi.fn(),
  getPayoutMethods: vi.fn(),
  getPayoutRequests: vi.fn(),
  createPayoutMethod: vi.fn(),
  updatePayoutMethod: vi.fn(),
  deletePayoutMethod: vi.fn(),
  requestPayout: vi.fn(),
  quoteTokensToUsd: (t: number, r: number) => t * r,
}));

// Import diferido tras el mock para que el componente tome los stubs.
import { PayoutSection } from "./PayoutSection";
import {
  getPayoutConfig,
  getPayoutMethods,
  getPayoutRequests,
} from "../api/payouts";

const cfgMock = vi.mocked(getPayoutConfig);
const methodsMock = vi.mocked(getPayoutMethods);
const requestsMock = vi.mocked(getPayoutRequests);

const p = getMessages("es").payouts;

const CONFIG: PayoutConfig = {
  tokenUsdRate: 0.01,
  minTokens: 100,
  currency: "USD",
  balance: { available: 5000, earned: 12000, pendingPayout: 250 },
};

const METHOD: PayoutMethodDTO = {
  id: "m1",
  type: "paypal",
  label: "PayPal personal",
  mask: { email: "j***@x.com" },
  isDefault: true,
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const REQUEST: PayoutRequestDTO = {
  id: "r1",
  amountTokens: 1000,
  amountUsd: 10,
  currency: "USD",
  rate: 0.01,
  status: "requested",
  methodLabel: "PayPal personal",
  rejectionReason: null,
  requestedAt: "2026-02-01T00:00:00.000Z",
  decidedAt: null,
  paidAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PayoutSection initial load (Promise.allSettled resilience)", () => {
  it("renders balance, a method, and history rows when all three calls succeed", async () => {
    cfgMock.mockResolvedValue(CONFIG);
    methodsMock.mockResolvedValue([METHOD]);
    requestsMock.mockResolvedValue([REQUEST]);

    render(<PayoutSection language="es" token="tok" />);

    // Balance section.
    expect(await screen.findByText(p.balanceTitle)).toBeInTheDocument();
    expect(screen.getByText(p.available)).toBeInTheDocument();

    // Method rendered (not the empty "no methods" text). The label appears in
    // the method row, the request <select> option and the history row.
    expect(screen.getAllByText(METHOD.label).length).toBeGreaterThan(0);
    expect(screen.queryByText(p.noMethods)).toBeNull();

    // History row rendered (not the empty/error text). The amount cell mixes a
    // formatted number node and the "tokens" word, so match on the cell's
    // combined textContent to confirm a data row — not a placeholder — exists.
    expect(
      screen.getByText((_content, el) => el?.textContent === `${(1000).toLocaleString("es-CO")} ${p.tokens}`),
    ).toBeInTheDocument();
    expect(screen.queryByText(p.noRequests)).toBeNull();
    expect(screen.queryByText(p.loadError)).toBeNull();

    // Full-tab error/retry state must NOT be present.
    expect(screen.queryByRole("button", { name: p.retry })).toBeNull();
  });

  it("keeps the whole tab intact and shows a contained history message when getPayoutRequests fails", async () => {
    cfgMock.mockResolvedValue(CONFIG);
    methodsMock.mockResolvedValue([METHOD]);
    requestsMock.mockRejectedValue(new Error("history boom"));

    render(<PayoutSection language="es" token="tok" />);

    // Layout INTACT: every section heading is present. Query by the heading
    // role to disambiguate from buttons that reuse the same label (e.g. the
    // "Solicitar retiro" request button shares the request section's title).
    expect(await screen.findByRole("heading", { name: p.balanceTitle })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: p.converterTitle })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: p.methodsTitle })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: p.requestTitle })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: p.historyTitle })).toBeInTheDocument();

    // Methods still rendered (config+methods succeeded). Label shows in the
    // method row and the request <select> option, so assert at least one.
    expect(screen.getAllByText(METHOD.label).length).toBeGreaterThan(0);

    // History area shows the contained loadError message...
    expect(screen.getByText(p.loadError)).toBeInTheDocument();
    // ...and NOT the raw error or an empty-state text.
    expect(screen.queryByText("history boom")).toBeNull();
    expect(screen.queryByText(p.noRequests)).toBeNull();

    // Crucially: the component did NOT collapse to the full-tab error state.
    expect(screen.queryByRole("button", { name: p.retry })).toBeNull();
  });

  it("shows the full-tab error state with a retry button when getPayoutConfig fails", async () => {
    cfgMock.mockRejectedValue(new Error("config boom"));
    methodsMock.mockResolvedValue([METHOD]);
    requestsMock.mockResolvedValue([REQUEST]);

    render(<PayoutSection language="es" token="tok" />);

    // The error message (the rejection's own message) and the retry button render.
    expect(await screen.findByText("config boom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: p.retry })).toBeInTheDocument();

    // The normal sections are NOT rendered (full-tab error branch).
    expect(screen.queryByText(p.balanceTitle)).toBeNull();
    expect(screen.queryByText(p.historyTitle)).toBeNull();
    expect(screen.queryByText(METHOD.label)).toBeNull();

    // Sanity: config getter actually rejected as set up.
    await waitFor(() => expect(cfgMock).toHaveBeenCalledWith("tok"));
  });
});
