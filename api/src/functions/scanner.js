import { app } from '@azure/functions';
import Alpaca from '@alpacahq/alpaca-trade-api';

const alpaca = new Alpaca({
  keyId: process.env.ALPACA_API_KEY,
  secretKey: process.env.ALPACA_SECRET_KEY,
  paper: true,
});

const UNIVERSE = [
  'AAPL','MSFT','TSLA','NVDA','AMD','META','AMZN','GOOG','NFLX','COIN',
  'PLTR','SOFI','MARA','RIOT','HOOD','SNAP','UBER','SQ','SHOP','RBLX',
  'SPY','QQQ','IWM','TQQQ','SOXL','ARKK',
];

app.http('scanner', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'scanner',
  handler: async (request) => {
    try {
      const body = await request.json();
      const lookback = body.lookback || 60;

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - lookback);

      const results = [];

      for (const symbol of UNIVERSE) {
        try {
          const bars = await alpaca.getBarsV2(symbol, {
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0],
            timeframe: '1Day',
            limit: lookback,
          });

          const data = [];
          for await (const bar of bars) {
            data.push(bar);
          }

          if (data.length < 10) continue;

          // Compute metrics
          const ranges = data.map((b) => (b.HighPrice - b.LowPrice) / b.LowPrice * 100);
          const avgRange = ranges.reduce((s, v) => s + v, 0) / ranges.length;
          const avgVolume = data.reduce((s, b) => s + b.Volume, 0) / data.length;

          // Capture rate: days where intraday range >= 1%
          const captureCount1 = ranges.filter((r) => r >= 1.0).length;
          const captureRate1 = captureCount1 / ranges.length * 100;
          const captureCount05 = ranges.filter((r) => r >= 0.5).length;
          const captureRate05 = captureCount05 / ranges.length * 100;

          // Range consistency (std dev of daily range)
          const rangeStd = Math.sqrt(
            ranges.reduce((s, r) => s + (r - avgRange) ** 2, 0) / ranges.length
          );
          const consistency = Math.max(0, 100 - rangeStd * 20);

          // Gap risk: avg absolute overnight gap
          let totalGap = 0;
          for (let i = 1; i < data.length; i++) {
            totalGap += Math.abs(data[i].OpenPrice - data[i - 1].ClosePrice) / data[i - 1].ClosePrice * 100;
          }
          const avgGap = data.length > 1 ? totalGap / (data.length - 1) : 0;
          const gapSafety = Math.max(0, 100 - avgGap * 25);

          // Win streaks (consecutive 1%+ range days)
          let maxStreak = 0, streak = 0;
          for (const r of ranges) {
            if (r >= 1.0) { streak++; maxStreak = Math.max(maxStreak, streak); }
            else { streak = 0; }
          }

          // Volume score (log-normalized)
          const volumeScore = Math.min(100, Math.log10(avgVolume / 100000) * 25);

          // Composite score
          const composite = Math.round(
            captureRate1 * 0.30 +
            consistency * 0.20 +
            avgRange * 5 * 0.15 +
            volumeScore * 0.10 +
            gapSafety * 0.15 +
            Math.min(100, maxStreak * 15) * 0.10
          );

          // Intraday move from open
          const intradayHighFromOpen = data.reduce((s, b) =>
            s + (b.HighPrice - b.OpenPrice) / b.OpenPrice * 100, 0) / data.length;
          const intradayLowFromOpen = data.reduce((s, b) =>
            s + (b.OpenPrice - b.LowPrice) / b.OpenPrice * 100, 0) / data.length;

          results.push({
            symbol,
            composite_score: composite,
            avg_range_pct: Math.round(avgRange * 100) / 100,
            capture_rate_1pct: Math.round(captureRate1 * 10) / 10,
            capture_rate_05pct: Math.round(captureRate05 * 10) / 10,
            consistency: Math.round(consistency * 10) / 10,
            avg_volume: Math.round(avgVolume),
            volume_score: Math.round(volumeScore * 10) / 10,
            gap_risk_pct: Math.round(avgGap * 100) / 100,
            gap_safety: Math.round(gapSafety * 10) / 10,
            max_win_streak: maxStreak,
            avg_high_from_open: Math.round(intradayHighFromOpen * 100) / 100,
            avg_low_from_open: Math.round(intradayLowFromOpen * 100) / 100,
            days_analyzed: data.length,
          });
        } catch {
          // Skip symbols that fail (delisted, no data, etc.)
          continue;
        }
      }

      results.sort((a, b) => b.composite_score - a.composite_score);
      return { jsonBody: results };
    } catch (err) {
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});
