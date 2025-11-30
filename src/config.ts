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
    timeframe: process.env.TRADING_TIMEFRAME || "5m", // Changed from 1m to 5m
    riskPerTrade: parseFloat(process.env.RISK_PER_TRADE || "0.01"), // 1%

    // Level 1: Basic Safety
    stopLossPercent: parseFloat(process.env.STOP_LOSS_PERCENT || "2"), // 2%
    takeProfitPercent: parseFloat(process.env.TAKE_PROFIT_PERCENT || "3"), // 3%
    rsiPeriod: parseInt(process.env.RSI_PERIOD || "14", 10),
    rsiOverbought: parseInt(process.env.RSI_OVERBOUGHT || "60", 10), // Changed from 70
    rsiOversold: parseInt(process.env.RSI_OVERSOLD || "40", 10), // Changed from 30
    bbPeriod: parseInt(process.env.BB_PERIOD || "20", 10),
    bbStdDev: parseFloat(process.env.BB_STD_DEV || "2"),

    // Level 2: Intermediate Filters
    trailingStopPercent: parseFloat(process.env.TRAILING_STOP_PERCENT || "1.5"), // 1.5%
    minVolumeMultiplier: parseFloat(process.env.MIN_VOLUME_MULTIPLIER || "1.5"), // 1.5x avg volume
    smaPeriodShort: parseInt(process.env.SMA_PERIOD_SHORT || "50", 10),
    smaPeriodLong: parseInt(process.env.SMA_PERIOD_LONG || "200", 10),
    riskRewardRatio: parseFloat(process.env.RISK_REWARD_RATIO || "2"), // 1:2

    // Level 3: Advanced Analytics
    atrPeriod: parseInt(process.env.ATR_PERIOD || "14", 10),
    atrMultiplier: parseFloat(process.env.ATR_MULTIPLIER || "2"),
    useAtrStopLoss: process.env.USE_ATR_STOP_LOSS === "true",
    useKellyCriterion: process.env.USE_KELLY_CRITERION === "true",
    kellyFraction: parseFloat(process.env.KELLY_FRACTION || "0.25"), // Conservative Kelly
    multiTimeframes: (process.env.MULTI_TIMEFRAMES || "5m,15m,1h").split(","),
    useMultiTimeframeConfirmation: process.env.USE_MULTI_TIMEFRAME === "true",
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
