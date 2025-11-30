import * as fs from "fs";
import * as path from "path";
import { logger } from "./logger";

export interface Position {
  amount: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  highestPrice: number; // For trailing stop
  entryTime: number;
  symbol: string;
}

export interface Trade {
  entryPrice: number;
  exitPrice: number;
  amount: number;
  profit: number;
  profitPercent: number;
  duration: number; // in ms
  exitReason: string; // "stop_loss" | "take_profit" | "trailing_stop" | "signal"
  timestamp: number;
}

export class PositionManager {
  private position: Position | null = null;
  private stateFile = path.join(process.cwd(), "position_state.json");
  private trades: Trade[] = [];
  private tradesFile = path.join(process.cwd(), "trades.json");

  constructor() {
    this.loadState();
    this.loadTrades();
  }

  private loadState() {
    try {
      if (fs.existsSync(this.stateFile)) {
        const data = fs.readFileSync(this.stateFile, "utf-8");
        this.position = JSON.parse(data);
        logger.info("Loaded existing position from state file");
      }
    } catch (error) {
      logger.error({ err: error }, "Failed to load position state");
    }
  }

  private saveState() {
    try {
      fs.writeFileSync(this.stateFile, JSON.stringify(this.position, null, 2));
    } catch (error) {
      logger.error({ err: error }, "Failed to save position state");
    }
  }

  private loadTrades() {
    try {
      if (fs.existsSync(this.tradesFile)) {
        const data = fs.readFileSync(this.tradesFile, "utf-8");
        this.trades = JSON.parse(data);
      }
    } catch (error) {
      logger.error({ err: error }, "Failed to load trades history");
    }
  }

  private saveTrades() {
    try {
      fs.writeFileSync(this.tradesFile, JSON.stringify(this.trades, null, 2));
    } catch (error) {
      logger.error({ err: error }, "Failed to save trades history");
    }
  }

  public openPosition(
    amount: number,
    entryPrice: number,
    stopLoss: number,
    takeProfit: number,
    symbol: string
  ): void {
    this.position = {
      amount,
      entryPrice,
      stopLoss,
      takeProfit,
      highestPrice: entryPrice,
      entryTime: Date.now(),
      symbol,
    };
    this.saveState();

    logger.info(
      {
        entryPrice,
        stopLoss,
        takeProfit,
        amount,
        potentialLoss:
          (((entryPrice - stopLoss) / entryPrice) * 100).toFixed(2) + "%",
        potentialGain:
          (((takeProfit - entryPrice) / entryPrice) * 100).toFixed(2) + "%",
      },
      "Position opened"
    );
  }

  public closePosition(exitPrice: number, exitReason: string): Trade | null {
    if (!this.position) return null;

    const profit =
      (exitPrice - this.position.entryPrice) * this.position.amount;
    const profitPercent =
      ((exitPrice - this.position.entryPrice) / this.position.entryPrice) * 100;
    const duration = Date.now() - this.position.entryTime;

    const trade: Trade = {
      entryPrice: this.position.entryPrice,
      exitPrice,
      amount: this.position.amount,
      profit,
      profitPercent,
      duration,
      exitReason,
      timestamp: Date.now(),
    };

    this.trades.push(trade);
    this.saveTrades();

    logger.info(
      {
        exitPrice,
        profit: profit.toFixed(2),
        profitPercent: profitPercent.toFixed(2) + "%",
        exitReason,
        durationMinutes: (duration / 60000).toFixed(1),
      },
      "Position closed"
    );

    this.position = null;
    this.saveState();

    return trade;
  }

  public updateTrailingStop(
    currentPrice: number,
    trailingPercent: number
  ): void {
    if (!this.position) return;

    // Update highest price if current price is higher
    if (currentPrice > this.position.highestPrice) {
      this.position.highestPrice = currentPrice;

      // Update trailing stop
      const newStopLoss = currentPrice * (1 - trailingPercent / 100);

      // Only move stop loss up, never down
      if (newStopLoss > this.position.stopLoss) {
        this.position.stopLoss = newStopLoss;
        this.saveState();

        logger.info(
          {
            newStopLoss: newStopLoss.toFixed(2),
            highestPrice: currentPrice.toFixed(2),
          },
          "Trailing stop updated"
        );
      }
    }
  }

  public checkStopLoss(currentPrice: number): boolean {
    if (!this.position) return false;
    return currentPrice <= this.position.stopLoss;
  }

  public checkTakeProfit(currentPrice: number): boolean {
    if (!this.position) return false;
    return currentPrice >= this.position.takeProfit;
  }

  public hasPosition(): boolean {
    return this.position !== null;
  }

  public getPosition(): Position | null {
    return this.position;
  }

  public getTrades(): Trade[] {
    return this.trades;
  }

  public getStats() {
    if (this.trades.length === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        avgWin: 0,
        avgLoss: 0,
        totalProfit: 0,
        totalProfitPercent: 0,
      };
    }

    const wins = this.trades.filter((t) => t.profit > 0);
    const losses = this.trades.filter((t) => t.profit <= 0);

    const totalProfit = this.trades.reduce((sum, t) => sum + t.profit, 0);
    const totalProfitPercent = this.trades.reduce(
      (sum, t) => sum + t.profitPercent,
      0
    );
    const avgWin =
      wins.length > 0
        ? wins.reduce((sum, t) => sum + t.profit, 0) / wins.length
        : 0;
    const avgLoss =
      losses.length > 0
        ? losses.reduce((sum, t) => sum + t.profit, 0) / losses.length
        : 0;

    return {
      totalTrades: this.trades.length,
      winRate: (wins.length / this.trades.length) * 100,
      avgWin,
      avgLoss,
      totalProfit,
      totalProfitPercent,
    };
  }
}
