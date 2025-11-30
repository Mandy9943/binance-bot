# Binance Trading Bot (Bun + TypeScript)

This is a high-performance trading bot for Binance, optimized for speed using Bun. It currently runs on the **Binance Testnet** by default.

## Prerequisites

- [Bun](https://bun.sh/) installed.
- A Binance account (for Testnet, you can use GitHub login).

## Setup

1.  **Get Testnet Credentials**:
    - Go to [Binance Testnet](https://testnet.binance.vision/).
    - Log in with GitHub.
    - Click "Generate HMAC_SHA256 Key".
    - Copy the **API Key** and **Secret Key**.

2.  **Configure Environment**:
    - Copy `.env.example` to `.env`:
      ```bash
      cp .env.example .env
      ```
    - Edit `.env` and paste your keys:
      ```env
      BINANCE_API_KEY=your_actual_api_key
      BINANCE_API_SECRET=your_actual_secret_key
      ```
    - Adjust trading parameters if needed (e.g., `RISK_PER_TRADE`, `TRADING_SYMBOL`).

3.  **Install Dependencies**:
    ```bash
    bun install
    ```

## Running the Bot

To start the bot:

```bash
bun run src/index.ts
```

## Strategy

The bot uses a **Mean Reversion** strategy combining **RSI** and **Bollinger Bands**:

- **BUY Signal**: Price closes **below** the Lower Bollinger Band AND RSI is **below** 30 (Oversold).
- **SELL Signal**: Price closes **above** the Upper Bollinger Band AND RSI is **above** 70 (Overbought).

## Disclaimer

This bot is for educational purposes. Trading cryptocurrencies involves significant risk. Use at your own risk.
