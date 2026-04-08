"use client";
import { useEffect, useRef } from "react";
import {
  createChart,
  createSeriesMarkers,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
} from "lightweight-charts";

interface OHLCVBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface SignalMarker {
  timestamp: string;
  direction: string;
}

interface Props {
  ohlcv: OHLCVBar[];
  signals?: SignalMarker[];
  height?: number;
}

function toDay(ts: string): string {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function CandlestickChart({ ohlcv, signals = [], height = 320 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || ohlcv.length === 0) return;

    const chart: IChartApi = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "#141414" },
        textColor: "#a1a1aa",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#1e1e1e" },
        horzLines: { color: "#1e1e1e" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#525252", width: 1, style: 3 },
        horzLine: { color: "#525252", width: 1, style: 3 },
      },
      rightPriceScale: { borderColor: "#2a2a2a" },
      timeScale: { borderColor: "#2a2a2a", timeVisible: true, secondsVisible: false },
    });

    // Candlestick series (v5 API)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    const candleData = ohlcv
      .map((b) => ({ time: toDay(b.timestamp) as any, open: b.open, high: b.high, low: b.low, close: b.close }))
      .sort((a, b) => (a.time > b.time ? 1 : -1));

    candleSeries.setData(candleData);

    // Volume series
    const volSeries = chart.addSeries(HistogramSeries, {
      color: "#2a2a2a",
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });

    volSeries.setData(
      ohlcv
        .map((b) => ({
          time: toDay(b.timestamp) as any,
          value: b.volume,
          color: b.close >= b.open ? "#05300e" : "#300a0a",
        }))
        .sort((a, b) => (a.time > b.time ? 1 : -1))
    );

    // Signal markers
    if (signals.length > 0) {
      const markers: any[] = signals
        .map((s) => {
          const time = toDay(s.timestamp);
          if (s.direction === "BUY")
            return { time, position: "belowBar", color: "#22c55e", shape: "arrowUp", text: "BUY" };
          if (s.direction === "SELL")
            return { time, position: "aboveBar", color: "#ef4444", shape: "arrowDown", text: "SELL" };
          return null;
        })
        .filter(Boolean)
        .sort((a: any, b: any) => (a.time > b.time ? 1 : -1));

      if (markers.length > 0) createSeriesMarkers(candleSeries, markers);
    }

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [ohlcv, signals, height]);

  if (ohlcv.length === 0) {
    return (
      <div style={{ height, background: "#141414", display: "flex", alignItems: "center", justifyContent: "center", color: "#52525b", fontSize: 13 }}>
        No chart data available
      </div>
    );
  }

  return <div ref={containerRef} style={{ width: "100%", height }} />;
}
