import { config } from "./config";
import { logger } from "./logger";
import type { Candle } from "./market_data";
import { Strategy } from "./strategy";

interface BacktestResult {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalReturn: number;
  totalReturnPercent: number;
  maxDrawdown: number;
  sharpeRatio: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  trades: BacktestTrade[];
}

interface BacktestTrade {
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  profit: number;
  profitPercent: number;
  exitReason: string;
}

interface BacktestPosition {
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  highestPrice: number;
  entryTime: number;
}

export async function runBacktest(
  candles: Candle[],
  initialBalance: number = 10000
): Promise<BacktestResult> {
  logger.info(`Starting backtest with ${candles.length} candles...`);

  const strategy = new Strategy();
  const trades: BacktestTrade[] = [];
  let balance = initialBalance;
  let position: BacktestPosition | null = null;
  let equity: number[] = [balance];

  // Initialize strategy with first 100 candles
  const initCandles = candles.slice(0, 100);
  strategy.init(initCandles);

  // Backtest remaining candles
  for (let i = 100; i < candles.length; i++) {
    const candle = candles[i];
    if (!candle) continue;

    const currentPrice = candle.close;

    // Check position exits
    if (position) {
      // Update trailing stop
      if (currentPrice > position.highestPrice) {
        position.highestPrice = currentPrice;
        const newStopLoss =
          currentPrice * (1 - config.trading.trailingStopPercent / 100);
        if (newStopLoss > position.stopLoss) {
          position.stopLoss = newStopLoss;
        }
      }

      // Check stop loss
      if (currentPrice <= position.stopLoss) {
        const profit =
          (currentPrice - position.entryPrice) *
          (balance / position.entryPrice);
        const profitPercent =
          ((currentPrice - position.entryPrice) / position.entryPrice) * 100;

        trades.push({
          entryTime: position.entryTime,
          exitTime: candle.time,
          entryPrice: position.entryPrice,
          exitPrice: currentPrice,
          profit,
          profitPercent,
          exitReason: "stop_loss",
        });

        balance += profit;
        strategy.updatePerformance(profit);
        equity.push(balance);
        position = null;
        continue;
      }

      // Check take profit
      if (currentPrice >= position.takeProfit) {
        const profit =
          (currentPrice - position.entryPrice) *
          (balance / position.entryPrice);
        const profitPercent =
          ((currentPrice - position.entryPrice) / position.entryPrice) * 100;

        trades.push({
          entryTime: position.entryTime,
          exitTime: candle.time,
          entryPrice: position.entryPrice,
          exitPrice: currentPrice,
          profit,
          profitPercent,
          exitReason: "take_profit",
        });

        balance += profit;
        strategy.updatePerformance(profit);
        equity.push(balance);
        position = null;
        continue;
      }
    }

    // Evaluate strategy
    const result = await strategy.evaluate(candle);

    if (result.signal === "BUY" && !position) {
      const amountToSpend = strategy.calculatePositionSize(balance);
      if (amountToSpend >= 10) {
        position = {
          entryPrice: currentPrice,
          stopLoss: result.stopLoss!,
          takeProfit: result.takeProfit!,
          highestPrice: currentPrice,
          entryTime: candle.time,
        };
      }
    } else if (result.signal === "SELL" && position) {
      const profit =
        (currentPrice - position.entryPrice) * (balance / position.entryPrice);
      const profitPercent =
        ((currentPrice - position.entryPrice) / position.entryPrice) * 100;

      trades.push({
        entryTime: position.entryTime,
        exitTime: candle.time,
        entryPrice: position.entryPrice,
        exitPrice: currentPrice,
        profit,
        profitPercent,
        exitReason: "signal",
      });

      balance += profit;
      strategy.updatePerformance(profit);
      equity.push(balance);
      position = null;
    }
  }

  // Calculate metrics
  const wins = trades.filter((t) => t.profit > 0);
  const losses = trades.filter((t) => t.profit <= 0);

  const totalReturn = balance - initialBalance;
  const totalReturnPercent = (totalReturn / initialBalance) * 100;

  const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;

  const avgWin =
    wins.length > 0
      ? wins.reduce((sum, t) => sum + t.profit, 0) / wins.length
      : 0;
  const avgLoss =
    losses.length > 0
      ? losses.reduce((sum, t) => sum + t.profit, 0) / losses.length
      : 0;

  const profitFactor =
    losses.length > 0
      ? Math.abs(
          wins.reduce((sum, t) => sum + t.profit, 0) /
            losses.reduce((sum, t) => sum + t.profit, 0)
        )
      : wins.length > 0
      ? Infinity
      : 0;

  // Calculate max drawdown
  let maxDrawdown = 0;
  let peak = equity[0] || initialBalance;
  for (const value of equity) {
    if (value > peak) peak = value;
    const drawdown = ((peak - value) / peak) * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  // Calculate Sharpe Ratio (simplified, assuming daily returns)
  const returns = [];
  for (let i = 1; i < equity.length; i++) {
    const prev = equity[i - 1];
    const curr = equity[i];
    if (prev && curr) {
      returns.push((curr - prev) / prev);
    }
  }
  const avgReturn =
    returns.reduce((sum, r) => sum + r, 0) / (returns.length || 1);
  const stdDev = Math.sqrt(
    returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) /
      (returns.length || 1)
  );
  const sharpeRatio = stdDev !== 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

  const result: BacktestResult = {
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate,
    totalReturn,
    totalReturnPercent,
    maxDrawdown,
    sharpeRatio,
    avgWin,
    avgLoss,
    profitFactor,
    trades,
  };

  // Log results
  logger.info("=== BACKTEST RESULTS ===");
  logger.info(`Total Trades: ${result.totalTrades}`);
  logger.info(`Win Rate: ${result.winRate.toFixed(2)}%`);
  logger.info(
    `Total Return: ${result.totalReturn.toFixed(
      2
    )} (${result.totalReturnPercent.toFixed(2)}%)`
  );
  logger.info(`Max Drawdown: ${result.maxDrawdown.toFixed(2)}%`);
  logger.info(`Sharpe Ratio: ${result.sharpeRatio.toFixed(2)}`);
  logger.info(`Avg Win: ${result.avgWin.toFixed(2)}`);
  logger.info(`Avg Loss: ${result.avgLoss.toFixed(2)}`);
  logger.info(
    `Profit Factor: ${
      result.profitFactor === Infinity ? "∞" : result.profitFactor.toFixed(2)
    }`
  );
  logger.info("========================");

  return result;
}

// CLI execution
if (import.meta.main) {
  const days = parseInt(process.env.BACKTEST_DAYS || "30");
  const limit = days * 24 * (60 / parseInt(config.trading.timeframe));

  logger.info(`Fetching ${limit} candles for ${days} days backtest...`);

  const baseUrl = "https://api.binance.com";
  const endpoint = "/api/v3/klines";
  const symbol = config.trading.symbol.replace("/", "").toUpperCase();
  const url = `${baseUrl}${endpoint}?symbol=${symbol}&interval=${config.trading.timeframe}&limit=${limit}`;

  fetch(url)
    .then((res) => res.json())
    .then((data: any[]) => {
      const candles: Candle[] = data.map((k) => ({
        time: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
        isFinal: true,
      }));

      return runBacktest(candles);
    })
    .catch((err) => {
      logger.error({ err }, "Backtest failed");
      process.exit(1);
    });
}
