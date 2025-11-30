import ccxt from "ccxt";
import { config } from "./config";
import { logger } from "./logger";

export class ExecutionService {
  private exchange: ccxt.Exchange;
  private symbol: string;

  constructor() {
    this.symbol = config.trading.symbol;
    this.exchange = new ccxt.binance({
      apiKey: config.binance.apiKey,
      secret: config.binance.apiSecret,
      enableRateLimit: true,
      options: {
        defaultType: "spot",
      },
    });

    if (config.binance.isTestnet) {
      this.exchange.setSandboxMode(true);
      logger.info("Execution Service initialized in TESTNET mode");
    }
  }

  public async getBalance(currency: string): Promise<number> {
    try {
      const balance = await this.exchange.fetchBalance();
      return balance[currency]?.free || 0;
    } catch (error) {
      logger.error({ err: error }, "Error fetching balance");
      return 0;
    }
  }

  public async buy(amount: number) {
    try {
      logger.info(`Placing BUY order for ${amount} ${this.symbol}`);
      const order = await this.exchange.createMarketBuyOrder(
        this.symbol,
        amount
      );
      logger.info(
        { orderId: order.id, price: order.price },
        "BUY Order Executed"
      );
      return order;
    } catch (error) {
      logger.error({ err: error }, "Error placing BUY order");
      throw error;
    }
  }

  public async sell(amount: number) {
    try {
      logger.info(`Placing SELL order for ${amount} ${this.symbol}`);
      const order = await this.exchange.createMarketSellOrder(
        this.symbol,
        amount
      );
      logger.info(
        { orderId: order.id, price: order.price },
        "SELL Order Executed"
      );
      return order;
    } catch (error) {
      logger.error({ err: error }, "Error placing SELL order");
      throw error;
    }
  }
}
