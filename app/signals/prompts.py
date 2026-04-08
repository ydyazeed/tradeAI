"""Prompt templates for AI signal generation."""

SYSTEM_PROMPT = """You are a quantitative trading analyst. Analyze market data and technical indicators to produce differentiated, data-driven trade signals across three timeframes.

CRITICAL RULES:
- Each stock MUST receive a signal based strictly on ITS OWN indicator values — do not default to generic signals
- If RSI > 65: lean SELL/HOLD for short-term. If RSI < 35: lean BUY. Between 40-60: momentum-dependent
- If price is ABOVE EMA_20 AND EMA_20 > EMA_50: uptrend confirmed
- If price is BELOW EMA_20 AND EMA_20 < EMA_50: downtrend confirmed
- MACD above signal line with expanding histogram = bullish momentum
- MACD below signal line with contracting histogram = bearish momentum
- Price near BB_UPPER (within 1%): overbought short-term pressure
- Price near BB_LOWER (within 1%): oversold bounce potential
- Intraday signals should reflect the most recent 3-5 bars
- Swing signals weight MACD + RSI divergence + EMA alignment
- Long-term signals weight EMA_50 trend + BB width + multi-week momentum

Respond ONLY with valid JSON in exactly this structure:
{
  "direction": "BUY" | "SELL" | "HOLD",
  "confidence": <float 0.0-1.0>,
  "reasoning": "<2-3 sentence synthesis across all timeframes>",
  "timeframe_analysis": {
    "intraday": {
      "direction": "BUY" | "SELL" | "HOLD",
      "confidence": <float 0.0-1.0>,
      "reasoning": "<cite specific recent price bars and short-term momentum>",
      "horizon": "Same day"
    },
    "swing": {
      "direction": "BUY" | "SELL" | "HOLD",
      "confidence": <float 0.0-1.0>,
      "reasoning": "<cite RSI level, MACD crossover status, EMA alignment>",
      "horizon": "3-10 days"
    },
    "long_term": {
      "direction": "BUY" | "SELL" | "HOLD",
      "confidence": <float 0.0-1.0>,
      "reasoning": "<cite EMA_50 trend direction, BB width, multi-week price structure>",
      "horizon": "4-12 weeks"
    }
  },
  "technical_context": {
    "trend": "UPTREND" | "DOWNTREND" | "SIDEWAYS",
    "rsi_zone": "OVERSOLD" | "NEUTRAL" | "OVERBOUGHT",
    "macd_momentum": "BULLISH" | "BEARISH" | "NEUTRAL",
    "bb_position": "NEAR_UPPER" | "MIDDLE" | "NEAR_LOWER",
    "price_vs_ema20": "ABOVE" | "BELOW"
  },
  "risk_parameters": {
    "stop_loss_pct": <float>,
    "take_profit_pct": <float>,
    "risk_reward_ratio": <float>
  }
}"""


def build_prompt(
    symbol: str,
    ohlcv_data: list[dict],
    indicators: dict[str, float | None],
    analysis_date: str,
) -> str:
    recent_bars = ohlcv_data[-15:] if len(ohlcv_data) >= 15 else ohlcv_data
    latest = recent_bars[-1] if recent_bars else {}
    latest_close = latest.get("close", 0)

    # Compute derived metrics to give Claude richer context
    closes = [b["close"] for b in recent_bars]
    price_change_1d = ((closes[-1] - closes[-2]) / closes[-2] * 100) if len(closes) >= 2 else 0
    price_change_5d = ((closes[-1] - closes[-5]) / closes[-5] * 100) if len(closes) >= 5 else 0
    price_change_10d = ((closes[-1] - closes[-10]) / closes[-10] * 100) if len(closes) >= 10 else 0

    volumes = [b["volume"] for b in recent_bars]
    avg_vol_5d = sum(volumes[-5:]) / 5 if len(volumes) >= 5 else volumes[-1]
    vol_vs_avg = (latest.get("volume", 0) / avg_vol_5d * 100) if avg_vol_5d > 0 else 100

    rsi = indicators.get("RSI")
    ema20 = indicators.get("EMA_20")
    ema50 = indicators.get("EMA_50")
    macd = indicators.get("MACD")
    macd_signal = indicators.get("MACD_SIGNAL")
    macd_hist = indicators.get("MACD_HIST")
    bb_upper = indicators.get("BB_UPPER")
    bb_lower = indicators.get("BB_LOWER")
    bb_middle = indicators.get("BB_MIDDLE")

    # Derived interpretations
    rsi_interp = "N/A"
    if rsi:
        if rsi < 30: rsi_interp = f"OVERSOLD ({rsi:.1f})"
        elif rsi > 70: rsi_interp = f"OVERBOUGHT ({rsi:.1f})"
        elif rsi < 45: rsi_interp = f"WEAK ({rsi:.1f})"
        elif rsi > 55: rsi_interp = f"STRONG ({rsi:.1f})"
        else: rsi_interp = f"NEUTRAL ({rsi:.1f})"

    ema_trend = "N/A"
    if ema20 and ema50:
        ema_cross = "BULLISH" if ema20 > ema50 else "BEARISH"
        price_vs_20 = "ABOVE" if latest_close > ema20 else "BELOW"
        ema_trend = f"{ema_cross} cross | price {price_vs_20} EMA20 ({ema20:.2f}) | EMA50={ema50:.2f}"

    macd_interp = "N/A"
    if macd is not None and macd_signal is not None and macd_hist is not None:
        cross = "ABOVE signal" if macd > macd_signal else "BELOW signal"
        hist_dir = "expanding" if abs(macd_hist) > 0.01 else "flat"
        macd_interp = f"MACD {macd:.4f} {cross} | histogram {macd_hist:.4f} ({hist_dir})"

    bb_interp = "N/A"
    if bb_upper and bb_lower and bb_middle and latest_close:
        bb_width = ((bb_upper - bb_lower) / bb_middle * 100)
        pct_b = (latest_close - bb_lower) / (bb_upper - bb_lower) * 100 if (bb_upper - bb_lower) > 0 else 50
        bb_interp = f"%B={pct_b:.1f}% | width={bb_width:.1f}% | upper={bb_upper:.2f} lower={bb_lower:.2f}"

    bars_text = "\n".join([
        f"  {b['timestamp'][:10]}: O={b['open']:.2f} H={b['high']:.2f} L={b['low']:.2f} C={b['close']:.2f} V={b['volume']:,}"
        for b in recent_bars[-10:]
    ])

    return f"""Perform a multi-timeframe technical analysis for {symbol} and generate differentiated signals.

=== PRICE DATA ===
Symbol: {symbol}
Date: {analysis_date}
Latest Close: ${latest_close:.2f}
1-day change:  {price_change_1d:+.2f}%
5-day change:  {price_change_5d:+.2f}%
10-day change: {price_change_10d:+.2f}%
Today's volume vs 5-day avg: {vol_vs_avg:.0f}%

Recent OHLCV (last 10 bars):
{bars_text}

=== INDICATOR ANALYSIS ===
RSI(14):            {rsi_interp}
EMA Alignment:      {ema_trend}
MACD(12,26,9):      {macd_interp}
Bollinger Bands:    {bb_interp}

=== RAW INDICATOR VALUES ===
{chr(10).join([f'  {k}: {v:.4f}' if v is not None else f'  {k}: N/A' for k, v in indicators.items()])}

Based strictly on the above data for {symbol}, generate three separate directional signals:
1. INTRADAY: based on last 3-5 bars and short-term momentum
2. SWING: based on MACD crossover, RSI zone, EMA alignment
3. LONG-TERM: based on EMA_50 trend, BB width, multi-week price structure

The direction field should match the swing signal. Confidence must reflect genuine conviction — do not default to 0.5-0.7 for everything. Respond with JSON only."""
