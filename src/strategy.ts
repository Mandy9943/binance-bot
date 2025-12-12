import { config } from "./config";
import {
  calculateATR,
  calculateBollingerBands,
  calculateEMA,
  calculateRSI,
  calculateSMA,
} from "./indicators";
import { logger } from "./logger";
import type { Candle } from "./market_data";

export enum Signal {
  BUY = "BUY",
  SELL = "SELL",
  NONE = "NONE",
}

export interface StrategyResult {
  signal: Signal;
  stopLoss?: number;
  takeProfit?: number;
  reason?: string;
}

export class Strategy {
  private closes: number[] = [];
  private highs: number[] = [];
  private lows: number[] = [];
  private volumes: number[] = [];
  private bufferSize = 250; // Increased for SMA 200

  // Multi-timeframe data
  private mtf15mCloses: number[] = [];
  private mtf1hCloses: number[] = [];

  // Performance tracking for Kelly Criterion
  private wins: number = 0;
  private losses: number = 0;
  private totalWinAmount: number = 0;
  private totalLossAmount: number = 0;

  constructor() {}

  public init(candles: Candle[]) {
    for (const candle of candles) {
      if (candle.isFinal) {
        this.closes.push(candle.close);
        this.highs.push(candle.high);
        this.lows.push(candle.low);
        this.volumes.push(candle.volume);

        if (this.closes.length > this.bufferSize) {
          this.closes.shift();
          this.highs.shift();
          this.lows.shift();
          this.volumes.shift();
        }
      }
    }
    logger.info(
      `Strategy initialized with ${this.closes.length} historical candles.`
    );
  }

  public initMultiTimeframe(timeframeData: Map<string, Candle[]>) {
    const mtf15m = timeframeData.get("15m");
    const mtf1h = timeframeData.get("1h");

    if (mtf15m) {
      this.mtf15mCloses = mtf15m.map((c) => c.close);
      logger.info(
        `Loaded ${this.mtf15mCloses.length} candles for 15m timeframe`
      );
    }

    if (mtf1h) {
      this.mtf1hCloses = mtf1h.map((c) => c.close);
      logger.info(`Loaded ${this.mtf1hCloses.length} candles for 1h timeframe`);
    }
  }

  public updatePerformance(profit: number) {
    if (profit > 0) {
      this.wins++;
      this.totalWinAmount += profit;
    } else {
      this.losses++;
      this.totalLossAmount += Math.abs(profit);
    }
  }

  public async evaluate(candle: Candle): Promise<StrategyResult> {
    if (!candle.isFinal) {
      return { signal: Signal.NONE };
    }

    this.closes.push(candle.close);
    this.highs.push(candle.high);
    this.lows.push(candle.low);
    this.volumes.push(candle.volume);

    if (this.closes.length > this.bufferSize) {
      this.closes.shift();
      this.highs.shift();
      this.lows.shift();
      this.volumes.shift();
    }

    const minRequired = Math.max(
      config.trading.rsiPeriod,
      config.trading.bbPeriod,
      config.trading.smaPeriodLong
    );

    if (this.closes.length < minRequired) {
      logger.info(`Buffering data... ${this.closes.length}/${minRequired}`);
      return { signal: Signal.NONE };
    }

    try {
      // Calculate all indicators
      const rsiValues = calculateRSI(this.closes, config.trading.rsiPeriod);
      const bbValues = calculateBollingerBands(
        this.closes,
        config.trading.bbPeriod,
        config.trading.bbStdDev
      );
      const smaShort = calculateSMA(this.closes, config.trading.smaPeriodShort);
      const smaLong = calculateSMA(this.closes, config.trading.smaPeriodLong);
      const atrValues = calculateATR(
        this.highs,
        this.lows,
        this.closes,
        config.trading.atrPeriod
      );

      const currentRsi = rsiValues[rsiValues.length - 1];
      const currentBbUpper = bbValues.upper[bbValues.upper.length - 1];
      const currentBbLower = bbValues.lower[bbValues.lower.length - 1];
      const currentBbMiddle = bbValues.middle[bbValues.middle.length - 1];
      const currentSMAShort = smaShort[smaShort.length - 1];
      const currentSMALong = smaLong[smaLong.length - 1];
      const currentATR = atrValues[atrValues.length - 1];
      const currentVolume = candle.volume;
      const avgVolume =
        this.volumes.reduce((a, b) => a + b, 0) / this.volumes.length;

      if (
        currentRsi === undefined ||
        currentBbUpper === undefined ||
        currentBbLower === undefined ||
        currentBbMiddle === undefined
      ) {
        logger.warn("Indicators not ready yet (undefined values)");
        return { signal: Signal.NONE };
      }

      const price = candle.close;

      // Level 2: Volume Filter
      const hasEnoughVolume =
        currentVolume >= avgVolume * config.trading.minVolumeMultiplier;

      // Level 2: Trend Filter (SMA 50/200)
      const isUptrend =
        currentSMAShort !== undefined &&
        currentSMALong !== undefined &&
        currentSMAShort > currentSMALong;
      const isDowntrend =
        currentSMAShort !== undefined &&
        currentSMALong !== undefined &&
        currentSMAShort < currentSMALong;

      // Level 3: Multi-timeframe confirmation
      let mtfConfirmed = true;
      if (config.trading.useMultiTimeframeConfirmation) {
        mtfConfirmed = this.confirmMultiTimeframe();
      }

      logger.info(
        {
          price,
          rsi: currentRsi.toFixed(2),
          bbLower: currentBbLower.toFixed(2),
          bbUpper: currentBbUpper.toFixed(2),
          smaShort: currentSMAShort?.toFixed(2),
          smaLong: currentSMALong?.toFixed(2),
          trend: isUptrend ? "UP" : isDowntrend ? "DOWN" : "NEUTRAL",
          volRatio: (currentVolume / avgVolume).toFixed(2),
          volumeOK: hasEnoughVolume,
          mtfOK: mtfConfirmed,
        },
        "Indicator Update"
      );

      // BUY Signal Logic
      if (
        price < currentBbLower &&
        currentRsi < config.trading.rsiOversold &&
        (!config.trading.smaPeriodLong ||
          !config.trading.requireUptrend ||
          isUptrend) && // Optional uptrend check
        hasEnoughVolume && // Volume filter (Level 2)
        mtfConfirmed // Multi-timeframe confirmation (Level 3)
      ) {
        // Level 1: Calculate Stop Loss and Take Profit
        let stopLoss: number;

        if (config.trading.useAtrStopLoss && currentATR !== undefined) {
          // Level 3: ATR-based stop loss
          stopLoss = price - currentATR * config.trading.atrMultiplier;
        } else {
          // Level 1: Percentage-based stop loss
          stopLoss = price * (1 - config.trading.stopLossPercent / 100);
        }

        const takeProfit = price * (1 + config.trading.takeProfitPercent / 100);

        // Level 2: Verify Risk/Reward Ratio
        const potentialLoss = price - stopLoss;
        const potentialGain = takeProfit - price;
        const rrRatio = potentialGain / potentialLoss;

        if (rrRatio < config.trading.riskRewardRatio) {
          logger.warn(
            {
              rrRatio: rrRatio.toFixed(2),
              required: config.trading.riskRewardRatio,
            },
            "Risk/Reward ratio too low, skipping trade"
          );
          return { signal: Signal.NONE };
        }

        logger.info(
          {
            stopLoss: stopLoss.toFixed(2),
            takeProfit: takeProfit.toFixed(2),
            rrRatio: rrRatio.toFixed(2),
          },
          "BUY Signal Detected"
        );

        return {
          signal: Signal.BUY,
          stopLoss,
          takeProfit,
          reason: "RSI oversold + BB lower breach + filters passed",
        };
      }

      // SELL Signal Logic
      if (price > currentBbUpper && currentRsi > config.trading.rsiOverbought) {
        logger.info("SELL Signal Detected");
        return {
          signal: Signal.SELL,
          reason: "RSI overbought + BB upper breach",
        };
      }

      return { signal: Signal.NONE };
    } catch (error) {
      logger.error({ err: error }, "Error calculating indicators");
      return { signal: Signal.NONE };
    }
  }

  private confirmMultiTimeframe(): boolean {
    // Check if 15m and 1h are in uptrend
    if (this.mtf15mCloses.length < 50 || this.mtf1hCloses.length < 50) {
      return true; // Not enough data, skip check
    }

    const ema15m = calculateEMA(this.mtf15mCloses, 20);
    const ema1h = calculateEMA(this.mtf1hCloses, 20);

    const current15mPrice = this.mtf15mCloses[this.mtf15mCloses.length - 1];
    const current15mEMA = ema15m[ema15m.length - 1];
    const current1hPrice = this.mtf1hCloses[this.mtf1hCloses.length - 1];
    const current1hEMA = ema1h[ema1h.length - 1];

    if (
      current15mPrice === undefined ||
      current15mEMA === undefined ||
      current1hPrice === undefined ||
      current1hEMA === undefined
    ) {
      return true;
    }

    const is15mUptrend = current15mPrice > current15mEMA;
    const is1hUptrend = current1hPrice > current1hEMA;

    return is15mUptrend && is1hUptrend;
  }

  public calculatePositionSize(balance: number): number {
    if (!config.trading.useKellyCriterion) {
      // Default: Fixed percentage
      return balance * config.trading.riskPerTrade;
    }

    // Level 3: Kelly Criterion
    const totalTrades = this.wins + this.losses;
    if (totalTrades < 10) {
      // Not enough data, use conservative default
      return balance * config.trading.riskPerTrade;
    }

    const winRate = this.wins / totalTrades;
    const avgWin = this.totalWinAmount / (this.wins || 1);
    const avgLoss = this.totalLossAmount / (this.losses || 1);

    // Kelly formula: (p * b - q) / b
    // where p = win rate, q = 1 - p, b = avg win / avg loss
    const b = avgWin / avgLoss;
    const kellyPercent = (winRate * b - (1 - winRate)) / b;

    // Apply Kelly fraction for safety
    const adjustedKelly = Math.max(
      0,
      Math.min(kellyPercent * config.trading.kellyFraction, 0.1) // Max 10%
    );

    logger.info(
      {
        winRate: (winRate * 100).toFixed(1) + "%",
        avgWin: avgWin.toFixed(2),
        avgLoss: avgLoss.toFixed(2),
        kellyPercent: (adjustedKelly * 100).toFixed(2) + "%",
      },
      "Kelly Criterion Position Sizing"
    );

    return balance * adjustedKelly;
  }
}
