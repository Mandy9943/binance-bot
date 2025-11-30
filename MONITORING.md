# 📊 Guía de Monitoreo del Bot

## Logs Principales

### ✅ Estado del Bot
```
Starting Binance Trading Bot...
Execution Service initialized in TESTNET mode
Initial Balance: 10000 USDT
Strategy initialized with 100 historical candles
WebSocket connection established
```

### 📈 Actualizaciones de Indicadores (cada minuto)
```
Indicator Update
  price: 90883.01         ← Precio actual de BTC
  rsi: 56.99              ← RSI (30=sobreventa, 70=sobrecompra)
  bbLower: 90775.38       ← Banda inferior
  bbUpper: 90919.22       ← Banda superior
```

**Interpretación:**
- Si `precio < bbLower` Y `rsi < 30` → El bot **COMPRARÁ** 🟢
- Si `precio > bbUpper` Y `rsi > 70` → El bot **VENDERÁ** 🔴
- De lo contrario → Sin operación ⚪

### 💰 Cuando COMPRA
```
BUY Signal Detected
Placing BUY order for 0.05 BTC/USDT
BUY Order Executed
  orderId: 12345
  price: 90883.01
Entered Position: 0.05 BTC
```

### 💵 Cuando VENDE
```
SELL Signal Detected
Placing SELL order for 0.05 BTC/USDT  
SELL Order Executed
  orderId: 12346
  price: 91200.00
Exited Position
New Balance: 10100 USDT    ← Tu nuevo saldo (ganancia/pérdida)
```

## Ver tu Saldo Actual

El bot muestra el saldo en **dos momentos**:

1. **Al iniciar:** `Initial Balance: 10000 USDT`
2. **Después de vender:** `New Balance: 10100 USDT`

## Cómo Calcular Ganancias

```
Ganancia = New Balance - Initial Balance
Ejemplo: 10100 - 10000 = +100 USDT (1% ganancia)
```

## Problemas Comunes

### ⚠️ "Insufficient funds"
→ No tienes suficiente saldo para operar (mínimo ~10 USDT)

### ⚠️ "WebSocket connection closed"
→ El bot se reconectará automáticamente en 5 segundos

### ⚠️ "Error placing BUY/SELL order"
→ Verifica tus credenciales de API o límites de Binance

## Configuración Actual

Tu bot usa la estrategia **RSI + Bollinger Bands** con:
- **Timeframe:** 1 minuto
- **RSI Oversold:** < 30 (señal de compra)
- **RSI Overbought:** > 70 (señal de venta)
- **Risk per Trade:** 1% del saldo total
- **Ambiente:** TESTNET (dinero ficticio)

---

**💡 Tip:** Deja el bot corriendo y revisa los logs cada hora. En mercados normales, puede tardar horas o días en encontrar una oportunidad de trading perfecta.
