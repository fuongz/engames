// The shared online layer: protocol, tickets, the RoomGame contract and the
// registry. Pure — the browser client lives in ./client and is exported
// separately so a Worker never bundles DOM code.

export * from "./protocol";
export * from "./room-game";
export * from "./ticket";
export { findOnlineGame, onlineGames } from "./registry";
