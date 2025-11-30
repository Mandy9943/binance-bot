import { config } from "./config";
import { ExecutionService } from "./execution";
import { logger } from "./logger";
import { MarketData } from "./market_data";
import { Signal, Strategy } from "./strategy";

async function main() {
  logger.info("Starting Binance Trading Bot...");

  const marketData = new MarketData();
  const strategy = new Strategy();
  const execution = new ExecutionService();

  // Simple in-memory state
  let positionAmount = 0;

  // Check initial balance
  const quoteCurrency = config.trading.symbol.split("/")[1];
  const baseCurrency = config.trading.symbol.split("/")[0];

  let quoteBalance = await execution.getBalance(quoteCurrency);
  logger.info(`Initial Balance: ${quoteBalance} ${quoteCurrency}`);

  // Fetch historical data to fast-forward strategy
  const history = await marketData.getRecentCandles(100);
  strategy.init(history);

  marketData.onCandle(async (candle) => {
    const signal = await strategy.update(candle);

    if (signal === Signal.BUY && positionAmount === 0) {
      // Calculate position size (e.g., 95% of available balance to be safe with fees)
      // For "riskPerTrade" usually means risk of loss, but here let's assume we use a portion of capital.
      // Let's just use a fixed percentage of balance for simplicity as per "riskPerTrade" config (interpreted as position size for now or we can do full balance).
      // If riskPerTrade is 0.01 (1%), we buy with 1% of balance.

      quoteBalance = await execution.getBalance(quoteCurrency);
      const amountToSpend = quoteBalance * config.trading.riskPerTrade;

      // We need to convert quote amount to base amount (approx)
      // This is a market order, so we specify amount in base currency usually for CCXT?
      // CCXT createMarketBuyOrder takes amount in BASE currency.
      // So we need price.
      const price = candle.close;
      const baseAmount = amountToSpend / price;

      // Ensure min notional (Binance usually 10 USDT).
      if (amountToSpend < 10) {
        logger.warn(
          `Insufficient funds or position size too small: ${amountToSpend} ${quoteCurrency}`
        );
        return;
      }

      try {
        const order = await execution.buy(baseAmount);
        positionAmount += order.amount; // Use filled amount
        logger.info(`Entered Position: ${positionAmount} ${baseCurrency}`);
      } catch (e) {
        logger.error("Failed to execute BUY");
      }
    } else if (signal === Signal.SELL && positionAmount > 0) {
      try {
        const order = await execution.sell(positionAmount);
        positionAmount = 0; // Assuming full sell
        logger.info("Exited Position");

        // Log new balance
        quoteBalance = await execution.getBalance(quoteCurrency);
        logger.info(`New Balance: ${quoteBalance} ${quoteCurrency}`);
      } catch (e) {
        logger.error("Failed to execute SELL");
      }
    }
  });

  marketData.start();
}

main().catch((err) => {
  logger.error({ err }, "Fatal Error");
  process.exit(1);
});
