import { config } from "./config";
import { calculateBollingerBands, calculateRSI } from "./indicators";
import { logger } from "./logger";
import type { Candle } from "./market_data";

export enum Signal {
  BUY = "BUY",
  SELL = "SELL",
  NONE = "NONE",
}

export class Strategy {
  private closes: number[] = [];
  private bufferSize = 100; // Keep enough history for indicators

  constructor() {}

  public init(candles: Candle[]) {
    for (const candle of candles) {
      if (candle.isFinal) {
        this.closes.push(candle.close);
        if (this.closes.length > this.bufferSize) {
          this.closes.shift();
        }
      }
    }
    logger.info(
      `Strategy initialized with ${this.closes.length} historical candles.`
    );
  }

  public async update(candle: Candle): Promise<Signal> {
    // We only trade on closed candles to avoid repainting/fakeouts
    if (!candle.isFinal) {
      return Signal.NONE;
    }

    this.closes.push(candle.close);

    if (this.closes.length > this.bufferSize) {
      this.closes.shift();
    }

    if (
      this.closes.length <
      Math.max(config.trading.rsiPeriod, config.trading.bbPeriod)
    ) {
      logger.info(`Buffering data... ${this.closes.length}/${this.bufferSize}`);
      return Signal.NONE;
    }

    try {
      // Calculate Indicators
      const rsiValues = calculateRSI(this.closes, config.trading.rsiPeriod);
      const bbValues = calculateBollingerBands(
        this.closes,
        config.trading.bbPeriod,
        config.trading.bbStdDev
      );

      // Get the latest values
      // Note: My manual implementation returns arrays aligned with the end of data
      const currentRsi = rsiValues[rsiValues.length - 1];
      const currentBbUpper = bbValues.upper[bbValues.upper.length - 1];
      const currentBbLower = bbValues.lower[bbValues.lower.length - 1];
      const currentBbMiddle = bbValues.middle[bbValues.middle.length - 1];

      if (
        currentRsi === undefined ||
        currentBbUpper === undefined ||
        currentBbLower === undefined ||
        currentBbMiddle === undefined
      ) {
        logger.warn("Indicators not ready yet (undefined values)");
        return Signal.NONE;
      }

      const currentBb = {
        upper: currentBbUpper,
        lower: currentBbLower,
        middle: currentBbMiddle,
      };

      const price = candle.close;

      logger.info(
        {
          price,
          rsi: currentRsi,
          bbLower: currentBb.lower,
          bbUpper: currentBb.upper,
        },
        "Indicator Update"
      );

      // Strategy Logic
      if (price < currentBb.lower && currentRsi < config.trading.rsiOversold) {
        logger.info("BUY Signal Detected");
        return Signal.BUY;
      }

      if (
        price > currentBb.upper &&
        currentRsi > config.trading.rsiOverbought
      ) {
        logger.info("SELL Signal Detected");
        return Signal.SELL;
      }

      return Signal.NONE;
    } catch (error) {
      logger.error({ err: error }, "Error calculating indicators");
      return Signal.NONE;
    }
  }
}
