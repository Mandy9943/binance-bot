import WebSocket from "ws";
import { config } from "./config";
import { logger } from "./logger";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isFinal: boolean;
}

type CandleCallback = (candle: Candle) => void;

export class MarketData {
  private ws: WebSocket | null = null;
  private callbacks: CandleCallback[] = [];
  private isTestnet: boolean;
  private symbol: string;
  private interval: string;

  constructor() {
    this.isTestnet = config.binance.isTestnet;
    this.symbol = config.trading.symbol.replace("/", "").toLowerCase();
    this.interval = config.trading.timeframe;
  }

  public onCandle(callback: CandleCallback) {
    this.callbacks.push(callback);
  }

  public start() {
    // Use Production WebSocket for market data even in Testnet mode
    // because Testnet WebSocket is often unreliable or down.
    // Execution will still happen on Testnet via CCXT sandbox mode.
    const baseUrl = "wss://stream.binance.com:9443/ws";
    // const baseUrl = this.isTestnet
    //   ? "wss://testnet.binance.vision/ws"
    //   : "wss://stream.binance.com:9443/ws";

    const streamName = `${this.symbol}@kline_${this.interval}`;
    const url = `${baseUrl}/${streamName}`;

    logger.info(`Connecting to WebSocket: ${url}`);

    this.ws = new WebSocket(url);

    this.ws.on("open", () => {
      logger.info("WebSocket connection established.");
    });

    this.ws.on("message", (data: WebSocket.Data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.e === "kline") {
          const k = msg.k;
          const candle: Candle = {
            time: k.t,
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v),
            isFinal: k.x,
          };

          this.notify(candle);
        }
      } catch (error) {
        logger.error({ err: error }, "Error parsing WebSocket message");
      }
    });

    this.ws.on("close", () => {
      logger.warn("WebSocket connection closed. Reconnecting in 5s...");
      setTimeout(() => this.start(), 5000);
    });

    this.ws.on("error", (err) => {
      logger.error({ err }, "WebSocket error");
    });
  }

  public async getRecentCandles(limit: number = 100): Promise<Candle[]> {
    const baseUrl = "https://api.binance.com";
    const endpoint = "/api/v3/klines";
    const url = `${baseUrl}${endpoint}?symbol=${this.symbol.toUpperCase()}&interval=${
      this.interval
    }&limit=${limit}`;

    logger.info(`Fetching historical data from: ${url}`);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = (await response.json()) as any[];

      return data.map((k: any) => ({
        time: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
        isFinal: true, // Historical candles are always final
      }));
    } catch (error) {
      logger.error({ err: error }, "Failed to fetch historical candles");
      return [];
    }
  }

  private notify(candle: Candle) {
    for (const cb of this.callbacks) {
      cb(candle);
    }
  }
}
