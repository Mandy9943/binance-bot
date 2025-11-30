# 📊 Guía de Monitoreo del Bot (Estrategia Avanzada)

## 🆕 Configuración Mejorada

Tu bot ahora usa estrategia avanzada de **3 niveles**:

**Level 1 (Básico):**
- ✅ Stop Loss automático (-2%)
- ✅ Take Profit automático (+3%)
- ✅ RSI optimizado (40/60 en vez de 30/70)
- ✅ Timeframe 5 minutos (menos ruido)

**Level 2 (Intermedio):**
- ✅ Trailing Stop (sigue el precio si sube +1.5%)
- ✅ Filtro de volumen (solo opera con volumen alto)
- ✅ Filtro de tendencia (SMA 50/200 solo compra en uptrend)
- ✅ Risk/Reward ratio 1:2 (gana el doble de lo que arriesga)

**Level 3 (Avanzado):**
- ⚠️ ATR-based Stop Loss (dinámico según volatilidad) - DESACTIVADO por defecto
- ⚠️ Kelly Criterion (tamaño de posición inteligente) - DESACTIVADO por defecto
- ⚠️ Multi-timeframe (15m + 1h confirmación) - DESACTIVADO por defecto

## Logs Principales

### ✅ Inicio del Bot
```
Starting Binance Trading Bot...
Strategy Configuration
  timeframe: 5m
  stopLoss: 2%
  takeProfit: 3%
  trailingStop: 1.5%
  rsiLevels: 40/60
  useATR: false
  useKelly: false
  useMTF: false
Initial Balance: 10000 USDT
Strategy initialized with 100 historical candles
WebSocket connection established
```

### 📈 Actualización de Indicadores (cada 5 minutos)
```
Indicator Update
  price: 90883.01
  rsi: 52.79
  bbLower: 90798.12
  bbUpper: 90946.32
  smaShort: 90850.50       ← SMA 50
  smaLong: 90800.25        ← SMA 200
  trend: UP                ← Tendencia actual
  volumeOK: true           ← Volumen suficiente
  mtfOK: true              ← Multi-timeframe OK
```

**Interpretación de Señal de COMPRA:**
Para que el bot compre, TODAS estas condiciones deben cumplirse:
1. `precio < bbLower` (precio bajo)
2. `rsi < 40` (sobreventa)
3. `trend: UP` (tendencia alcista, SMA50 > SMA200)
4. `volumeOK: true` (volumen > 1.5x promedio)
5. `mtfOK: true` (si multi-timeframe está activo)
6. Risk/Reward >= 2:1

**Interpretación de Señal de VENTA:**
1. `precio > bbUpper` Y `rsi > 60` (sobrecompra)
2. O se alcanza **Take Profit** o **Stop Loss**

### 💰 Entrada de Posición (COMPRA)
```
BUY Signal Detected
  stopLoss: 89065.15       ← Precio de stop loss (-2%)
  takeProfit: 93609.50     ← Precio de take profit (+3%)
  rrRatio: 2.00            ← Risk/Reward ratio

Position opened
  entryPrice: 90883.01
  stopLoss: 89065.15
  takeProfit: 93609.50
  amount: 0.11
  potentialLoss: -2.00%
  potentialGain: +3.00%
```

### 🔄 Trailing Stop Actualizado
```
Trailing stop updated
  newStopLoss: 91200.50    ← Stop loss subió
  highestPrice: 92563.09   ← Nuevo precio máximo
```

### 💵 Salida de Posición

**Por Take Profit:**
```
Take Profit triggered!
New Balance after Take Profit
  balance: 10300 USDT
  profit: 300.00
  profitPercent: +3.00%
  totalTrades: 5
  winRate: 80.0%
  totalProfit: 450.00
```

**Por Stop Loss:**
```
Stop Loss triggered!
New Balance after Stop Loss
  balance: 9800 USDT
  profit: -200.00
  profitPercent: -2.00%
  totalTrades: 6
  winRate: 66.7%
  totalProfit: 250.00
```

**Por Señal de Venta:**
```
SELL Signal Detected
New Balance after Signal Exit
  balance: 10150 USDT
  profit: 150.00
  profitPercent: +1.50%
  totalTrades: 7
  winRate: 71.4%
  totalProfit: 400.00
```

## 🎯 Estadísticas de Performance

El bot ahora muestra:
- **totalTrades**: Número total de operaciones
- **winRate**: % de operaciones ganadoras
- **totalProfit**: Ganancia/pérdida acumulada

Estos datos se guardan en `trades.json` para análisis.

## 🧪 Backtesting (Probar Estrategia)

Antes de dejar el bot corriendo, puedes probarlo con datos históricos:

```bash
BACKTEST_DAYS=30 bun run src/backtester.ts
```

Esto te mostrará:
- Total Trades
- Win Rate
- Total Return (ganancia total)
- Max Drawdown (pérdida máxima)
- Sharpe Ratio (calidad de retornos)
- Profit Factor

**Ejemplo de resultado:**
```
=== BACKTEST RESULTS ===
Total Trades: 42
Win Rate: 65.00%
Total Return: 1250.50 (12.51%)
Max Drawdown: 5.20%
Sharpe Ratio: 1.85
Avg Win: 75.25
Avg Loss: -42.50
Profit Factor: 1.77
========================
```

## ⚙️ Activar Funciones Avanzadas (Level 3)

Por defecto, las funciones de Level 3 están **desactivadas** para seguridad.

Para activarlas, edita tu `.env`:

```bash
# ATR-based Stop Loss (recomendado si mercado es muy volátil)
USE_ATR_STOP_LOSS=true

# Kelly Criterion (ajusta tamaño de posición automáticamente)
# ⚠️ Solo activar después de 10+ trades exitosos
USE_KELLY_CRITERION=true

# Multi-timeframe Confirmation (más conservador)
USE_MULTI_TIMEFRAME=true
```

## 🛡️ Protección de Capital

Con la estrategia avanzada:
- **Nunca** pierdes más del 2% por operación (Stop Loss)
- **Siempre** buscas ganar mínimo 3% (Take Profit)
- Si el precio sube, el Stop Loss **sube contigo** (Trailing Stop)
- Solo operas en **tendencia alcista** con **volumen alto**

## 📁 Archivos Generados

- `position_state.json`: Estado actual de la posición (se recupera si reinicias el bot)
- `trades.json`: Historial completo de todas las operaciones

## Problemas Comunes

### ⚠️ "Risk/Reward ratio too low, skipping trade"
→ La operación no cumple con ratio 1:2. Esto es **bueno**, evita malos trades.

### ⚠️ "Insufficient funds"
→ No tienes suficiente saldo para operar (mínimo ~10 USDT)

### ℹ️ "Buffering data..."
→ Esperando datos históricos para SMA 200 (tarda ~15-20 min al inicio)

---

**💡 Tips:**
1. **Primero backtest:** Prueba con `bun run src/backtester.ts` antes de dejar corriendo el bot
2. **Revisa trades.json:** Analiza qué operaciones fueron buenas/malas
3. **Activa Level 3 gradualmente:** Primero solo ATR, luego MTF, por último Kelly
4. **Monitorea el winRate:** Si baja de 50%, revisa la configuración
