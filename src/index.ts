import { config } from "./config";
import { ExecutionService } from "./execution";
import { logger } from "./logger";
import { MarketData } from "./market_data";
import { PositionManager } from "./position_manager";
import { Strategy } from "./strategy";

async function main() {
  logger.info("Starting Binance Trading Bot...");
  logger.info(
    {
      timeframe: config.trading.timeframe,
      stopLoss: config.trading.stopLossPercent + "%",
      takeProfit: config.trading.takeProfitPercent + "%",
      trailingStop: config.trading.trailingStopPercent + "%",
      rsiLevels: `${config.trading.rsiOversold}/${config.trading.rsiOverbought}`,
      useATR: config.trading.useAtrStopLoss,
      useKelly: config.trading.useKellyCriterion,
      useMTF: config.trading.useMultiTimeframeConfirmation,
    },
    "Strategy Configuration"
  );

  const marketData = new MarketData();
  const strategy = new Strategy();
  const execution = new ExecutionService();
  const positionManager = new PositionManager();

  const quoteCurrency = config.trading.symbol.split("/")[1];
  const baseCurrency = config.trading.symbol.split("/")[0];

  let quoteBalance = await execution.getBalance(quoteCurrency);
  logger.info(`Initial Balance: ${quoteBalance} ${quoteCurrency}`);

  // Fetch historical data for main timeframe
  const history = await marketData.getRecentCandles(100);
  strategy.init(history);

  // Level 3: Fetch multi-timeframe data if enabled
  if (config.trading.useMultiTimeframeConfirmation) {
    const mtfData = await marketData.getRecentCandlesMultiTimeframe(
      config.trading.multiTimeframes,
      100
    );
    strategy.initMultiTimeframe(mtfData);
  }

  marketData.onCandle(async (candle) => {
    const currentPrice = candle.close;

    // Level 2: Check trailing stop if in position
    if (positionManager.hasPosition()) {
      positionManager.updateTrailingStop(
        currentPrice,
        config.trading.trailingStopPercent
      );

      // Level 1: Check stop loss
      if (positionManager.checkStopLoss(currentPrice)) {
        logger.warn("Stop Loss triggered!");
        try {
          const position = positionManager.getPosition();
          if (position) {
            const order = await execution.sell(position.amount);
            const trade = positionManager.closePosition(
              order.price || currentPrice,
              "stop_loss"
            );

            if (trade) {
              strategy.updatePerformance(trade.profit);
              quoteBalance = await execution.getBalance(quoteCurrency);
              logger.info(
                {
                  balance: quoteBalance,
                  profit: trade.profit.toFixed(2),
                  profitPercent: trade.profitPercent.toFixed(2) + "%",
                },
                `New Balance after Stop Loss`
              );
            }
          }
        } catch (e) {
          logger.error({ err: e }, "Failed to execute STOP LOSS");
        }
        return;
      }

      // Level 1: Check take profit
      if (positionManager.checkTakeProfit(currentPrice)) {
        logger.info("Take Profit triggered!");
        try {
          const position = positionManager.getPosition();
          if (position) {
            const order = await execution.sell(position.amount);
            const trade = positionManager.closePosition(
              order.price || currentPrice,
              "take_profit"
            );

            if (trade) {
              strategy.updatePerformance(trade.profit);
              quoteBalance = await execution.getBalance(quoteCurrency);
              logger.info(
                {
                  balance: quoteBalance,
                  profit: trade.profit.toFixed(2),
                  profitPercent: trade.profitPercent.toFixed(2) + "%",
                },
                `New Balance after Take Profit`
              );
            }
          }
        } catch (e) {
          logger.error({ err: e }, "Failed to execute TAKE PROFIT");
        }
        return;
      }
    }

    // Evaluate strategy
    const result = await strategy.evaluate(candle);

    if (result.signal === "BUY" && !positionManager.hasPosition()) {
      quoteBalance = await execution.getBalance(quoteCurrency);

      // Level 3: Kelly Criterion position sizing
      const amountToSpend = strategy.calculatePositionSize(quoteBalance);
      const price = candle.close;
      const baseAmount = amountToSpend / price;

      if (amountToSpend < 10) {
        logger.warn(
          `Insufficient funds or position size too small: ${amountToSpend} ${quoteCurrency}`
        );
        return;
      }

      try {
        const order = await execution.buy(baseAmount);
        const actualPrice = order.price || price;
        const actualAmount = order.amount;

        if (result.stopLoss && result.takeProfit) {
          positionManager.openPosition(
            actualAmount,
            actualPrice,
            result.stopLoss,
            result.takeProfit,
            config.trading.symbol
          );
        }
      } catch (e) {
        logger.error({ err: e }, "Failed to execute BUY");
      }
    } else if (result.signal === "SELL" && positionManager.hasPosition()) {
      try {
        const position = positionManager.getPosition();
        if (position) {
          const order = await execution.sell(position.amount);
          const trade = positionManager.closePosition(
            order.price || currentPrice,
            "signal"
          );

          if (trade) {
            strategy.updatePerformance(trade.profit);
            quoteBalance = await execution.getBalance(quoteCurrency);

            // Log performance stats
            const stats = positionManager.getStats();
            logger.info(
              {
                balance: quoteBalance,
                profit: trade.profit.toFixed(2),
                profitPercent: trade.profitPercent.toFixed(2) + "%",
                totalTrades: stats.totalTrades,
                winRate: stats.winRate.toFixed(1) + "%",
                totalProfit: stats.totalProfit.toFixed(2),
              },
              `New Balance after Signal Exit`
            );
          }
        }
      } catch (e) {
        logger.error({ err: e }, "Failed to execute SELL");
      }
    }
  });

  marketData.start();
}

main().catch((err) => {
  logger.error({ err }, "Fatal Error");
  process.exit(1);
});
