// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../components/dashboard", () => ({
  OrderRequestCard: ({ order }: any) => <div data-testid="order-card">{order?.id ?? "order"}</div>,
  RideRequestCard: ({ ride }: any) => <div data-testid="ride-card">{ride?.id ?? "ride"}</div>,
}));

vi.mock("lucide-react", () => ({
  AlertTriangle: () => null,
  Bike: () => null,
  Eye: () => null,
}));

import { HomeRequestList } from "../components/home/HomeRequestList";

const noop = vi.fn();

const baseProps = {
  requestsLoading: false,
  requestsError: false,
  totalRequests: 0,
  dismissed: new Set<string>(),
  onClearDismissed: noop,
  orders: [],
  rides: [],
  currency: "Rs.",
  config: { deliveryFee: 100, finance: { riderEarningPct: 80 } },
  onAcceptOrder: noop,
  onRejectOrder: noop,
  onAcceptRide: noop,
  onCounterRide: noop,
  onRejectOffer: noop,
  onIgnoreRide: noop,
  onDismiss: noop,
  acceptOrderPending: false,
  rejectOrderPending: false,
  acceptRidePending: false,
  counterRidePending: false,
  rejectOfferPending: false,
  ignoreRidePending: false,
  requestsServerTime: null,
  userId: "user-1",
  isRestricted: false,
  onRetry: noop,
  T: (key: string) => key,
};

describe("HomeRequestList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing with empty lists", () => {
    const { container } = render(<HomeRequestList {...baseProps} />);
    expect(container).toBeDefined();
  });

  it("shows skeleton placeholders when requestsLoading is true", () => {
    const { container } = render(<HomeRequestList {...baseProps} requestsLoading={true} />);
    expect(container.querySelectorAll(".shimmer-block").length).toBeGreaterThan(0);
  });

  it("renders order cards for each order in the list", () => {
    const orders = [
      { id: "ord-1", status: "pending" },
      { id: "ord-2", status: "pending" },
    ] as any[];
    render(<HomeRequestList {...baseProps} orders={orders} totalRequests={2} />);
    const cards = screen.getAllByTestId("order-card");
    expect(cards.length).toBe(2);
  });

  it("renders a ride card for each ride in the list", () => {
    const rides = [{ id: "ride-1", status: "pending" }] as any[];
    render(<HomeRequestList {...baseProps} rides={rides} totalRequests={1} />);
    expect(screen.getByTestId("ride-card")).toBeDefined();
  });

  it("hides ride cards when config.features.rides is false", () => {
    const rides = [{ id: "ride-1", status: "pending" }] as any[];
    const config = { ...baseProps.config, features: { rides: false } };
    render(<HomeRequestList {...baseProps} rides={rides} totalRequests={1} config={config} />);
    expect(screen.queryAllByTestId("ride-card").length).toBe(0);
  });

  it("hides food order cards when config.features.food is false", () => {
    const orders = [{ id: "ord-food-1", status: "pending", type: "food" }] as any[];
    const config = { ...baseProps.config, features: { food: false } };
    render(<HomeRequestList {...baseProps} orders={orders} totalRequests={1} config={config} />);
    expect(screen.queryAllByTestId("order-card").length).toBe(0);
  });

  it("hides mart order cards when config.features.mart is false", () => {
    const orders = [{ id: "ord-mart-1", status: "pending", type: "mart" }] as any[];
    const config = { ...baseProps.config, features: { mart: false } };
    render(<HomeRequestList {...baseProps} orders={orders} totalRequests={1} config={config} />);
    expect(screen.queryAllByTestId("order-card").length).toBe(0);
  });

  it("hides van order cards when config.features.van is false", () => {
    const orders = [{ id: "ord-van-1", status: "pending", type: "van" }] as any[];
    const config = { ...baseProps.config, features: { van: false } };
    render(<HomeRequestList {...baseProps} orders={orders} totalRequests={1} config={config} />);
    expect(screen.queryAllByTestId("order-card").length).toBe(0);
  });

  it("disabling food does not suppress mart or van order cards", () => {
    const orders = [
      { id: "ord-food-1", status: "pending", type: "food" },
      { id: "ord-mart-1", status: "pending", type: "mart" },
      { id: "ord-van-1",  status: "pending", type: "van"  },
    ] as any[];
    const config = { ...baseProps.config, features: { food: false, mart: true, van: true } };
    render(<HomeRequestList {...baseProps} orders={orders} totalRequests={3} config={config} />);
    expect(screen.getAllByTestId("order-card").length).toBe(2);
  });
});
