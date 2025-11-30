import dotenv from "dotenv";

dotenv.config();

export const config = {
  binance: {
    apiKey: process.env.BINANCE_API_KEY || "",
    apiSecret: process.env.BINANCE_API_SECRET || "",
    isTestnet: process.env.BINANCE_IS_TESTNET === "true",
  },
  trading: {
    symbol: process.env.TRADING_SYMBOL || "BTC/USDT",
    timeframe: process.env.TRADING_TIMEFRAME || "1m",
    riskPerTrade: parseFloat(process.env.RISK_PER_TRADE || "0.01"), // 1%
    rsiPeriod: parseInt(process.env.RSI_PERIOD || "14", 10),
    rsiOverbought: parseInt(process.env.RSI_OVERBOUGHT || "70", 10),
    rsiOversold: parseInt(process.env.RSI_OVERSOLD || "30", 10),
    bbPeriod: parseInt(process.env.BB_PERIOD || "20", 10),
    bbStdDev: parseFloat(process.env.BB_STD_DEV || "2"),
  },
  logging: {
    level: process.env.LOG_LEVEL || "info",
  },
};

if (!config.binance.apiKey || !config.binance.apiSecret) {
  console.warn(
    "WARNING: Binance API Key or Secret not found in environment variables."
  );
}
