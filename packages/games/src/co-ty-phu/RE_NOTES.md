# Cờ Tỷ Phú / Tycoon — notes

**Reference:** the property-trading board game genre with its usual international
rules. Everything you see is our own: a board of Vietnamese places, our own
prices and rents (`config.ts`), our own "Cơ hội" / "Khí vận" cards (`cards.ts`),
our own tokens (nón lá, đèn lồng, hoa sen, thuyền) and a lacquer-and-gold look.
No names, card texts, mascots, tokens or board look from any existing product.

## Files

| File | What |
| --- | --- |
| `config.ts` | the 40 squares (names, prices, rents, house costs), money, pacing, online settings, scores |
| `cards.ts` | the two decks and their effects |
| `logic.ts` | the rules, pure: state, `act(game, seat, action)`, `decider(game)`, rent, building, mortgage, jail, cards, auctions, trades, debts, bankruptcy |
| `ai.ts` | the computer player, pure: one action at a time, legal by construction |
| `sim.ts` | the clock around the rules: computer think time, people's decision clock online, dropped seats |
| `online.ts` | `RoomGame` adapter: `parseInput` whitelist, bots in empty seats, hidden RNG/decks in snapshots, results |
| `game.ts` / `art.ts` | the canvas shell and drawing |

## Board

Corners: Xuất phát (salary 200K), Trại giam (jail / just visiting), Quán nước
(rest), Vào tù (go to jail). Eight colour groups cheap → dear: Hà Giang–Cao Bằng,
Sa Pa–Mộc Châu–Điện Biên, Bến Tre–Cần Thơ–Châu Đốc, Quy Nhơn–Phong Nha–Huế,
Nha Trang–Hội An–Đà Nẵng, Vũng Tàu–Phú Quốc–Đà Lạt, Ninh Bình–Hải Phòng–Hạ Long,
Sài Gòn–Hà Nội. Transport: Bến xe, Ga tàu, Cảng biển, Sân bay (25/50/100/200K by
count). Utilities: Điện lực, Nhà máy nước (dice × 4 / × 10). Taxes 200K and 100K.
Money is in thousands of đồng and always written "200K". Start cash 1500K.

## Rules we use

| Rule | Choice |
| --- | --- |
| Unowned deed | buy at price, or it goes to **auction** (everyone still in, including the one who declined) |
| Auction | turn-based: each bidder in turn raises (≥ 10K over the leader) or passes for good; last one standing wins; no bids → stays with the bank |
| Rent | base; ×2 with the whole colour set and no houses; then by houses / hotel; nothing on a mortgaged deed |
| Building | full set, none mortgaged, evenly (a square may only go up from the group's minimum), 4 houses then a hotel; bank supply 32 houses / 12 hotels; only on your own turn (or while buying) |
| Selling | evenly from the top, half price; a hotel goes back to 4 houses if the bank has them, otherwise to as many as it has |
| Mortgage | half price, only with no buildings in the set; redeem for +10% |
| Doubles | roll again; 3 in a row → jail |
| Jail | from Vào tù, a card, or 3 doubles. Out by paying 50K or using a card before rolling, or rolling doubles (move by that roll, no extra roll). After the 3rd miss the 50K is charged and you move |
| Cards | 16 per deck; the out-of-jail card is kept until used, then goes back under its deck. "Nearest transport" pays double; "nearest utility" pays 10 × the dice just rolled |
| Debts | a payment you can't cover puts you in debt: sell / mortgage until it is paid (automatic as soon as the cash is there), or declare bankruptcy |
| Bankruptcy | to a player: buildings sold to the bank at half, then all cash, deeds (mortgaged stay mortgaged) and jail cards go to them. To the bank: deeds are unmortgaged and **auctioned** one by one |
| Trades | only the player whose turn it is proposes (up to 3 offers a turn); deeds, cash and jail cards both ways; no deed from a set with buildings; the other side accepts or declines |
| End | last solvent player wins. Optional time limit (30 / 60 min): checked between turns; then the highest net worth (cash + deeds at price, half if mortgaged, + buildings at cost) wins |

Deliberate simplifications: no building or trading outside your own turn; no 10%
fee when a mortgaged deed changes hands; a guard ends any game after 1500 turns
on net worth (bot-only Easy tables can stall without trades; real games end far
sooner — Normal/Hard bot games finish in ~100–250 turns).

## Computer players (`ai.ts`)

- **Easy**: buys on a whim if it keeps 60K, bids 50–130% of price, builds late
  (keeps a big cushion, never past 3 houses), rarely proposes trades.
- **Normal**: keeps a cushion sized to the worst rent on the board, values full
  sets ×2, builds evenly to hotels, proposes set-completing trades sometimes.
- **Hard**: pays up to complete or block a set (auctions to 180%), builds the
  three-house jump first, smaller cushion, trades more often and more shrewdly.
- Trades are judged by a holding value with a set bonus, minus a share of what
  the other side gains. A swap that finishes a set for both is the common deal.
  In a 60-game round robin (seeded) Hard won 34, Normal 18, Easy 8.

## Modes

- **Offline**: 2–4 players; 1–4 people on this phone (pass and play), the rest
  computers at one level. A game in progress is saved and resumes on open.
- **Online** (`versus`, bots fill empty seats): host picks total players (2/3/4)
  and time limit. 30 s per decision; on timeout the computer (Normal) decides
  safely (roll / end turn / its buy choice / pass / decline / raise money), and
  after one timeout the next decisions get 6 s until the player acts again. A
  dropped player's seat is played by the computer until they return.
- No undo vs the computer (dice game).

## Scores

- Solo (one person vs computers, only a win): net worth ÷ 10 × level (1/2/4)
  + 50/150/400 per computer beaten.
- Online board `co-ty-phu:versus`: winner 600 + net worth ÷ 10; second place
  150 in a 3–4 player game; others 0. `outcome` win/loss (draw if a time-limit
  finish ties on net worth).

## UI

Portrait 540×960 logical. Top: menu, clock (time limit), log. A strip with each
player's token and cash (tap for their assets). The board (1200 board-px) under
a camera that follows the moving token, or shows the whole board ("Cả bàn"),
pinch / drag to look around, a mini-map to jump to the whole board. Below, one
panel with the decision that matters now; sheets for assets (build / sell /
mortgage / redeem), the trade builder and deed cards (tap a square). Events play
back in order: dice tumble, token hops, then toasts and money floaters.

## Art

Key art from Codex (Vietnamese lacquer-painting look: red lacquer, jade, gold
leaf; a miniature Vietnam with a tile path, toy pawns, dice, red envelopes).
Raw PNGs in the git-ignored `art-src/co-ty-phu/`. Board, tokens, dice and icons
are drawn in `art.ts`. Text: Mali 600/700, titles and numbers Baloo 2 800, both
imported in `game.ts`.
