// The arcade ticket caps (docs/standards/tickets.md). Pure, so the server
// enforces them and the portal's deposit batcher splits by the same numbers.

/** One deposit may carry at most this many tickets; more is clamped to it. */
export const MAX_DEPOSIT = 5_000;
/** Per player, per game, per Vietnam day: at most this many earned tickets. */
export const DAILY_EARN_CAP = 50_000;
