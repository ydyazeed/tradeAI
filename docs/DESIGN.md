# TradeAI — Design System & UI Specification

## 1. Design Philosophy

**Brutalist Terminal Aesthetic** — inspired by .txt's retro-computing visual language. The UI communicates precision, transparency, and technical credibility. Every element feels like it belongs in a financial terminal reimagined through a modern brutalist lens.

### Core Principles

1. **Data density over decoration** — show more information, less chrome
2. **Monospace everything** — reinforces the terminal/code aesthetic
3. **Grid-locked layouts** — strict grid system, no floating elements
4. **Muted palette with signal colors** — neutral base, color only for actionable data
5. **No gradients, no rounded corners, no shadows** — flat, sharp, brutalist

---

## 2. Color System

### Base Palette

```
--bg-primary:       #0A0A0A    (near-black background)
--bg-secondary:     #141414    (card/panel background)
--bg-tertiary:      #1E1E1E    (hover states, subtle elevation)
--border:           #2A2A2A    (default borders)
--border-active:    #525252    (focused/active borders)

--text-primary:     #FAFAFA    (headings, primary content)
--text-secondary:   #A1A1AA    (secondary content, labels)
--text-muted:       #52525B    (disabled, timestamps)
```

### Signal Colors

```
--signal-buy:       #22C55E    (green — BUY signals, positive PnL)
--signal-sell:      #EF4444    (red — SELL signals, negative PnL)
--signal-hold:      #EAB308    (amber — HOLD signals, caution)
--signal-buy-bg:    #052E16    (green tint for backgrounds)
--signal-sell-bg:   #350A0A    (red tint for backgrounds)
--signal-hold-bg:   #352A04    (amber tint for backgrounds)
```

### Accent Colors (for UI sections, inspired by .txt's muted panels)

```
--accent-pink:      #E8C4C8    (auth pages, user-related panels)
--accent-olive:     #B8A848    (market data sections)
--accent-slate:     #94A3B8    (system/metrics panels)
```

### Checkered Pattern (decorative, from .txt inspiration)

Used as a decorative element in headers and empty states. CSS-generated checkerboard:
```css
.pattern-checker {
  background-image:
    linear-gradient(45deg, #1a1a1a 25%, transparent 25%),
    linear-gradient(-45deg, #1a1a1a 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #1a1a1a 75%),
    linear-gradient(-45deg, transparent 75%, #1a1a1a 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
}
```

---

## 3. Typography

### Font Stack

```
--font-mono:   "JetBrains Mono", "Fira Code", "SF Mono", "Cascadia Code", monospace
--font-pixel:  "Press Start 2P", monospace    (headings, hero text — optional display font)
```

All body text, data, labels, and UI elements use `--font-mono`. The pixel font is reserved for the landing page hero and section headers (like .txt's "NO BAD OUTPUTS").

### Scale

```
--text-xs:     0.75rem / 12px    (timestamps, metadata)
--text-sm:     0.875rem / 14px   (labels, secondary info)
--text-base:   1rem / 16px       (body text, table data)
--text-lg:     1.125rem / 18px   (subheadings)
--text-xl:     1.25rem / 20px    (section titles)
--text-2xl:    1.5rem / 24px     (page titles)
--text-hero:   3rem+ / 48px+     (landing page hero — pixel font)
```

### Rules

- Line height: 1.6 for body, 1.2 for headings
- Letter spacing: `0.02em` on all monospace text
- All caps for labels, section numbers, and nav items
- Tabular numbers (`font-variant-numeric: tabular-nums`) for all price/number displays

---

## 4. Layout System

### Grid

12-column grid, 16px gap, 24px page margin. Inspired by .txt's bento-box layout.

```
Dashboard:  [Sidebar 2col] [Main Content 10col]
Main:       Bento grid of cards — variable spans (2col, 3col, 4col, 6col)
Mobile:     Single column stack, sidebar collapses to top nav
```

### Breakpoints

```
sm:   640px    (mobile landscape)
md:   768px    (tablet)
lg:   1024px   (desktop)
xl:   1280px   (wide desktop)
2xl:  1536px   (ultrawide)
```

### Card System

Cards are the primary content container. Flat, bordered, no shadow, no radius.

```css
.card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  padding: 16px;
  border-radius: 0;     /* brutalist — no rounding */
}
.card:hover {
  border-color: var(--border-active);
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 12px;
}
.card-number {
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
```

Each card has a **section number** in the top-left (like .txt's "01", "04"), reinforcing the structured/indexed feel.

---

## 5. Component Specifications (shadcn/ui)

### 5.1 shadcn/ui Base Components

Use these shadcn components as the foundation, customized to match the brutalist theme:

| shadcn Component | Usage | Customization |
|------------------|-------|---------------|
| `Button` | All actions | No border-radius, monospace font, uppercase text |
| `Card` | Data panels | No border-radius, no shadow, 1px border |
| `Table` | Market data, signals, audit | Dense rows, monospace, tabular-nums |
| `Badge` | Signal direction, status tags | Square corners, border style |
| `Input` | Forms, search | No border-radius, monospace placeholder |
| `Dialog` | Confirmations | Centered, dark overlay |
| `Tabs` | Section navigation within panels | Underline style, no background |
| `Tooltip` | Data explanations | Dark bg, monospace |
| `Skeleton` | Loading states | Pulsing dark rectangles |
| `Separator` | Section dividers | Solid 1px border color |
| `ScrollArea` | Data tables, audit logs | Minimal scrollbar |
| `DropdownMenu` | User menu, filters | No radius, bordered |
| `Select` | Symbol picker, timeframe | No radius |
| `Switch` | Toggle settings | Square track |
| `Sheet` | Mobile sidebar | Slide from left |
| `Sonner/Toast` | Notifications | Bottom-right, dark, bordered |
| `Command` | Command palette (Cmd+K) | Terminal-style search |

### 5.2 Custom Components

#### Terminal Header

Top bar mimicking a terminal window. Shows system status.

```
┌─────────────────────────────────────────────────────────────┐
│ TRADEAI v1.0.0  │  ● LIVE  │  AAPL: 189.42  │  14:32:07 ET│
└─────────────────────────────────────────────────────────────┘
```

#### Signal Card

```
┌──────────────────────────────────┐
│ 01  AAPL SIGNAL                  │
│                                  │
│  ██ BUY ██     CONFIDENCE: 0.87  │
│                                  │
│  RSI oversold (28.3) with MACD   │
│  bullish crossover. Price near   │
│  lower Bollinger Band support.   │
│                                  │
│  RISK: Stop -2.3%  Target +5.1%  │
│  MODEL: claude-sonnet-4-6     │
│  ──────────────────────────────  │
│  2026-04-07 16:30:00 ET          │
└──────────────────────────────────┘
```

- Direction badge: green fill (BUY), red fill (SELL), amber outline (HOLD)
- Confidence as a progress bar with numeric value
- Reasoning in monospace text block
- Risk parameters as key-value pairs
- Timestamp and model info in muted text

#### Price Ticker Row

Inline price display with change indicator:

```
AAPL    189.42  ▲ +1.23 (+0.65%)    VOL 52.3M
EUR/USD   1.0847  ▼ -0.0012 (-0.11%)  VOL 1.2B
```

- Green/red for positive/negative change
- Triangle arrows (▲/▼) not colored arrows
- Right-aligned numeric columns with tabular-nums

#### Sparkline Chart

Miniature inline chart (60px tall, full card width) showing 30-day price trend. Use a lightweight chart library (lightweight-charts by TradingView or recharts).

- No axes, no labels — just the line
- Green line if current > 30d ago, red if lower
- Rendered in card backgrounds

#### Data Table (Market Data, Audit Logs)

Dense table with:
- Fixed header, scrollable body
- Alternating row backgrounds (#141414 / #1a1a1a)
- Sortable columns (click header → arrow indicator)
- Monospace tabular numbers throughout
- Pagination: `← 1 2 3 4 →` style (like .txt's carousel nav)

#### Command Palette

Triggered by `Cmd+K`. Terminal-style search across:
- Symbols ("AAPL", "EUR/USD")
- Actions ("Generate signal", "Fetch data")
- Pages ("Go to signals", "Open audit log")

Uses shadcn `Command` component styled as a terminal prompt:
```
> search symbols, actions, pages...
  ─────────────────────────────────
  SYMBOLS
    AAPL — Apple Inc.
    MSFT — Microsoft Corp.
  ACTIONS
    Generate signal for AAPL
    Fetch latest market data
```

---

## 6. Page Layouts

### 6.1 Landing Page

Full-width, no sidebar. Terminal-inspired hero section.

```
┌─────────────────────────────────────────────────────────────┐
│  TRADEAI        [Features]  [Docs]  [Login]  [Register]     │
├─────────────────────────────────────────────────────────────┤
│                                          ┌────────────────┐ │
│  01  AI-POWERED TRADING SIGNALS          │ ░░▓▓░░▓▓░░▓▓  │ │
│                                          │ ▓▓░░▓▓░░▓▓░░  │ │
│  TRADE                                   │ ░░▓▓░░▓▓░░▓▓  │ │
│     SMARTER                              │ ▓▓░░▓▓░░▓▓░░  │ │
│                                          └────────────────┘ │
│  {                                                          │
│    "signal": "BUY",                                         │
│    "confidence": 0.87,                                      │
│    "reasoning": "RSI oversold..."                           │
│  }                                                          │
│                                                             │
│  [Get Started]  [View Demo]                                 │
├─────────────────────────────────────────────────────────────┤
│  02  FEATURES              03  STACK                        │
│  ┌──────────┐ ┌──────────┐ ┌─────────────────────────────┐  │
│  │ Market   │ │ AI       │ │ Python · FastAPI · Claude    │  │
│  │ Data     │ │ Signals  │ │ PostgreSQL · pandas-ta      │  │
│  └──────────┘ └──────────┘ └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

Key elements:
- Pixel font hero text ("TRADE SMARTER")
- JSON code block showing sample signal (like .txt's JSON company info)
- Checkered pattern decorative element (top-right, like .txt)
- Section numbers (01, 02, 03)
- Bento grid of feature cards below
- Muted accent color blocks (pink for auth CTA, olive for data features)

### 6.2 Dashboard — Overview

```
┌─────────┬───────────────────────────────────────────────────┐
│         │  TERMINAL HEADER (status bar)                      │
│  NAV    ├───────────────────────────────────────────────────┤
│         │  ┌─────────────────────┐ ┌──────────────────────┐ │
│  01 ○   │  │ 01 MARKET OVERVIEW  │ │ 02 LATEST SIGNALS    │ │
│  Overview│  │                     │ │                      │ │
│         │  │ AAPL  189.42 ▲0.65% │ │ AAPL  BUY   0.87    │ │
│  02 ○   │  │ MSFT  415.20 ▼0.12% │ │ MSFT  HOLD  0.54    │ │
│  Signals│  │ EURUSD 1.084 ▼0.11% │ │ GOOG  SELL  0.72    │ │
│         │  │ [sparklines]        │ │                      │ │
│  03 ○   │  └─────────────────────┘ └──────────────────────┘ │
│  Audit  │  ┌─────────────────────┐ ┌──────────────────────┐ │
│         │  │ 03 INDICATORS       │ │ 04 SYSTEM STATUS     │ │
│  04 ○   │  │                     │ │                      │ │
│  Settings│  │ RSI: 28.3 OVERSOLD  │ │ ● API: Healthy       │ │
│         │  │ MACD: Bullish cross  │ │ ● DB: Connected      │ │
│         │  │ BB: Near lower band │ │ ● Data: Fresh (2m)   │ │
│         │  └─────────────────────┘ └──────────────────────┘ │
└─────────┴───────────────────────────────────────────────────┘
```

- Sidebar: icon + label nav, numbered sections, active state = filled dot
- Bento grid of 4 cards (2x2 on desktop, stacked on mobile)
- Each card has section number, title, dense data
- Market overview card: price list with sparklines
- Signals card: latest signals with direction badges
- Indicators card: key indicator values with interpretation
- System card: health status with colored dots

### 6.3 Dashboard — Signals Detail

```
┌─────────────────────────────────────────────────────────────┐
│  SIGNALS  /  AAPL                              [Generate ↻] │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────┐  │
│  │  LATEST SIGNAL                                        │  │
│  │                                                       │  │
│  │  ██████████████████████████                           │  │
│  │  ██      BUY       ██  CONFIDENCE ████████░░ 0.87    │  │
│  │  ██████████████████████████                           │  │
│  │                                                       │  │
│  │  REASONING                                            │  │
│  │  RSI is currently at 28.3, indicating oversold        │  │
│  │  conditions. MACD shows a bullish crossover with      │  │
│  │  the signal line. Price is testing the lower          │  │
│  │  Bollinger Band, suggesting potential support.        │  │
│  │                                                       │  │
│  │  RISK PARAMETERS                                      │  │
│  │  Stop Loss:  -2.3%  ($185.06)                        │  │
│  │  Target:     +5.1%  ($199.08)                        │  │
│  │  R:R Ratio:   2.22                                    │  │
│  │                                                       │  │
│  │  MODEL: claude-sonnet-4-6  │  TOKENS: 1,247         │  │
│  │  LATENCY: 2.3s            │  COST: $0.003            │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  SIGNAL HISTORY                                             │
│  ┌───────────┬──────────┬────────┬────────┬──────────────┐  │
│  │ Date      │ Direction│ Conf.  │ Model  │ Outcome      │  │
│  ├───────────┼──────────┼────────┼────────┼──────────────┤  │
│  │ 2026-04-07│ BUY      │  0.87  │ sonnet │ —            │  │
│  │ 2026-04-04│ HOLD     │  0.54  │ sonnet │ —            │  │
│  │ 2026-04-03│ SELL     │  0.72  │ haiku  │ +1.2%        │  │
│  └───────────┴──────────┴────────┴────────┴──────────────┘  │
│  ← 1 2 3 4 →                                               │
└─────────────────────────────────────────────────────────────┘
```

### 6.4 Dashboard — Audit Log (Admin)

```
┌─────────────────────────────────────────────────────────────┐
│  AUDIT LOG                            [Filter ▾] [Export ↓] │
├─────────────────────────────────────────────────────────────┤
│  > search logs...                                           │
│  ─────────────────────────────────────────────────────────  │
│  ┌──────────────┬────────┬─────────────┬──────┬──────────┐  │
│  │ Timestamp    │ User   │ Endpoint    │ Code │ Latency  │  │
│  ├──────────────┼────────┼─────────────┼──────┼──────────┤  │
│  │ 14:32:07.123 │ user@  │ GET /signals│ 200  │ 2.3s     │  │
│  │ 14:31:55.891 │ api-k  │ GET /market │ 200  │ 45ms     │  │
│  │ 14:31:42.004 │ admin  │ POST /signal│ 200  │ 2.1s     │  │
│  │ 14:30:11.567 │ anon   │ POST /login │ 401  │ 89ms     │  │
│  └──────────────┴────────┴─────────────┴──────┴──────────┘  │
│  ← 1 2 3 ... 47 →                                          │
│                                                             │
│  SIGNAL AUDIT (expandable row detail)                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  PROMPT                                               │  │
│  │  ```json                                              │  │
│  │  { "symbol": "AAPL", "ohlcv": [...], ... }           │  │
│  │  ```                                                  │  │
│  │  RESPONSE                                             │  │
│  │  ```json                                              │  │
│  │  { "direction": "BUY", "confidence": 0.87, ... }     │  │
│  │  ```                                                  │  │
│  │  TOKENS: 1,247 in / 312 out  COST: $0.003            │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Interaction Patterns

### Transitions
- No animations by default — instant state changes (brutalist ethos)
- Exception: skeleton loading shimmer (subtle pulse, 1.5s cycle)
- Exception: toast notifications slide in from right (200ms)

### Hover States
- Cards: border-color transition to `--border-active` (instant)
- Buttons: invert foreground/background colors (instant)
- Table rows: background shift to `--bg-tertiary` (instant)

### Loading States
- Skeleton blocks matching content layout (monospace character width)
- Terminal-style loading text: `Loading market data...` with blinking cursor

### Empty States
- Checkered pattern background (small, muted)
- Centered monospace text: `NO SIGNALS GENERATED YET`
- Action button below: `[Generate First Signal]`

### Keyboard Navigation
- `Cmd+K`: Command palette
- `1-5`: Navigate sidebar sections (when no input focused)
- `Esc`: Close modals/sheets
- `Tab`: Standard focus management with visible focus ring (2px solid white)

---

## 8. Responsive Behavior

| Breakpoint | Layout |
|------------|--------|
| < 768px | No sidebar, top hamburger nav. Single column cards stacked. Simplified tables (hide secondary columns). |
| 768-1024px | Collapsed sidebar (icons only). 2-column bento grid. Full tables with horizontal scroll. |
| 1024px+ | Full sidebar with labels. 2-4 column bento grid. Full tables. |

---

## 9. shadcn/ui Theme Configuration

```typescript
// tailwind.config.ts — theme extension
{
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', '"SF Mono"', 'monospace'],
        pixel: ['"Press Start 2P"', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '0px',   // brutalist — no rounding globally
      },
      colors: {
        border: '#2A2A2A',
        input: '#2A2A2A',
        ring: '#525252',
        background: '#0A0A0A',
        foreground: '#FAFAFA',
        primary: { DEFAULT: '#FAFAFA', foreground: '#0A0A0A' },
        secondary: { DEFAULT: '#141414', foreground: '#A1A1AA' },
        muted: { DEFAULT: '#1E1E1E', foreground: '#52525B' },
        accent: { DEFAULT: '#1E1E1E', foreground: '#FAFAFA' },
        destructive: { DEFAULT: '#EF4444', foreground: '#FAFAFA' },
        signal: {
          buy: '#22C55E',
          sell: '#EF4444',
          hold: '#EAB308',
          'buy-bg': '#052E16',
          'sell-bg': '#350A0A',
          'hold-bg': '#352A04',
        },
        panel: {
          pink: '#E8C4C8',
          olive: '#B8A848',
          slate: '#94A3B8',
        },
      },
    },
  },
}
```

### shadcn globals override (`globals.css`)

```css
* {
  border-radius: 0 !important;   /* enforce brutalist corners */
}

body {
  font-family: var(--font-mono);
  background: #0A0A0A;
  color: #FAFAFA;
  letter-spacing: 0.02em;
  -webkit-font-smoothing: antialiased;
}

/* Tabular numbers for all data displays */
[data-numeric] {
  font-variant-numeric: tabular-nums;
}

/* Terminal cursor blink for loading states */
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
.cursor-blink::after {
  content: '█';
  animation: blink 1s step-end infinite;
}
```
