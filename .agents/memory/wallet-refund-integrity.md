---
name: Wallet refund integrity (ride dispatch)
description: How ride wallet refunds must be computed and guarded to avoid over-refund and double-refund.
---

# Wallet refund integrity for failed rides

When a wallet-paid ride fails to find a driver (expired / no_riders_found in the
dispatch engine), the auto-refund must credit back **exactly what was debited at
booking**.

**Rule 1 — platformFee is NOT additive.** At booking, only `fareToCharge` is
debited. The stored `ride.fare` (= `platformFare`, equals `fareToCharge` when not
bargaining) and `ride.platformFee` (= `fareToCharge * 0.20`) are an accounting
*split* of that single charge. Refunding `fare + platformFee` over-refunds by ~20%.
Also, for bargained rides the stored `fare` (platformFare) differs from the charged
amount (validatedOffer), so neither column alone is reliable.

**How to apply:** Refund by summing the original `debit` wallet_transactions rows
for `reference = ride:${rideId}` (filter by `userId` too). That row is the single
source of truth for what was actually charged.

**Rule 2 — refund branches must be idempotent.** The dispatch engine can run
concurrently. The status-transition UPDATE must guard on current status
(`status IN ('searching','bargaining')`) in addition to `rider_id IS NULL`, so a
second concurrent pass updates 0 rows and returns before issuing a duplicate
credit. Guarding only on `rider_id IS NULL` is insufficient because rider_id stays
null after the first transition.

**Why:** Found during the full-stack connection audit — three identical refund
blocks (expired, attempt-cap no_riders, max-rounds no_riders) all over-refunded and
were not concurrency-safe.
