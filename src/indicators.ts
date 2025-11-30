export function calculateSMA(data: number[], period: number): number[] {
  const sma: number[] = [];
  if (data.length < period) return sma;

  for (let i = 0; i <= data.length - period; i++) {
    const slice = data.slice(i, i + period);
    const sum = slice.reduce((a, b) => a + b, 0);
    sma.push(sum / period);
  }
  return sma;
}

export function calculateStandardDeviation(
  data: number[],
  period: number
): number[] {
  const stdDevs: number[] = [];
  if (data.length < period) return stdDevs;

  const sma = calculateSMA(data, period);

  for (let i = 0; i < sma.length; i++) {
    const slice = data.slice(i, i + period);
    const mean = sma[i];
    if (mean === undefined) continue; // Safety check
    const squaredDiffs = slice.map((val) => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
    stdDevs.push(Math.sqrt(variance));
  }
  return stdDevs;
}

export function calculateBollingerBands(
  data: number[],
  period: number,
  stdDevMultiplier: number
): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = calculateSMA(data, period);
  const stdDevs = calculateStandardDeviation(data, period);

  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < middle.length; i++) {
    const mid = middle[i];
    const std = stdDevs[i];
    if (mid === undefined || std === undefined) continue;

    upper.push(mid + std * stdDevMultiplier);
    lower.push(mid - std * stdDevMultiplier);
  }

  return { upper, middle, lower };
}

export function calculateRSI(data: number[], period: number): number[] {
  if (data.length < period + 1) return [];

  const changes: number[] = [];
  for (let i = 1; i < data.length; i++) {
    changes.push(data[i] - data[i - 1]);
  }

  let gains = 0;
  let losses = 0;

  // First RSI
  for (let i = 0; i < period; i++) {
    const change = changes[i];
    if (change === undefined) continue;

    if (change > 0) gains += change;
    else losses -= change;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  const rsi: number[] = [];
  rsi.push(100 - 100 / (1 + avgGain / (avgLoss === 0 ? 1 : avgLoss)));

  // Subsequent RSIs
  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    if (change === undefined) continue;

    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rs = avgGain / (avgLoss === 0 ? 1 : avgLoss);
    rsi.push(100 - 100 / (1 + rs));
  }

  return rsi;
}

export function calculateEMA(data: number[], period: number): number[] {
  if (data.length < period) return [];

  const multiplier = 2 / (period + 1);
  const ema: number[] = [];

  // First EMA is SMA
  const smaArray = calculateSMA(data, period);
  if (smaArray.length === 0) return [];

  const firstSMA = smaArray[0];
  if (firstSMA === undefined) return [];

  ema.push(firstSMA);

  // Subsequent EMAs
  for (let i = period; i < data.length; i++) {
    const value = data[i];
    const prevEMA = ema[ema.length - 1];
    if (value === undefined || prevEMA === undefined) continue;

    const currentEMA = (value - prevEMA) * multiplier + prevEMA;
    ema.push(currentEMA);
  }

  return ema;
}

export function calculateATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number
): number[] {
  if (
    highs.length < period + 1 ||
    lows.length < period + 1 ||
    closes.length < period + 1
  ) {
    return [];
  }

  const trueRanges: number[] = [];

  // Calculate True Range for each period
  for (let i = 1; i < highs.length; i++) {
    const high = highs[i];
    const low = lows[i];
    const prevClose = closes[i - 1];

    if (high === undefined || low === undefined || prevClose === undefined) {
      continue;
    }

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }

  // Calculate ATR using EMA of True Range
  return calculateEMA(trueRanges, period);
}
