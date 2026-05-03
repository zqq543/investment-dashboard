# 📊 個人投資儀表板

以 **Next.js 14 + Notion** 為核心的個人投資追蹤系統，資料儲存於 Notion，前端部署於 Vercel，完全免費方案可用。

---

## 功能總覽

- **資產總覽**：總資產、今日 / 本週 / 本月變動
- **損益追蹤**：未實現損益（持股）、已實現損益（交易歷史）
- **資產曲線圖**：60 天歷史走勢（Recharts AreaChart）
- **資產分布圖**：現金 vs 各持股比例（Pie Chart）
- **持股清單**：市值、均成本、損益，含價格來源標示
- **最近交易紀錄**：最新 10 筆買賣紀錄
- **深色 / 淺色主題切換**
- **手動刷新價格**（15 分鐘快取）
- **每日自動快照**（Vercel Cron，每個交易日 17:00 台灣時間）

---

## 快速開始

### 1. 取得 Notion API Key

1. 前往 [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
2. 建立新 Integration，記下 **Internal Integration Secret**
3. 前往每個 Notion 資料庫頁面 → 右上角「...」→「Connect to」→ 選擇你的 Integration

### 2. 設定環境變數

```bash
cp .env.example .env.local
```

編輯 `.env.local`：

```env
NOTION_API_KEY=secret_xxx...
NOTION_DB_TRANSACTIONS=efeec7d17c1647f4901ea34d5bb25c72
NOTION_DB_CASHFLOW=93d3c5d202c34952b26dd60943129a0c
NOTION_DB_HOLDINGS=da55c763359b42edb985b4dfdc9d41f6
NOTION_DB_SNAPSHOT=cd7bd1299dd24c33a030f239c257b481
CRON_SECRET=your-random-secret
NEXT_PUBLIC_USD_TWD_RATE=32.0
```

> **資料庫 ID 取得方式**：在 Notion 中打開資料庫頁面，URL 格式為 `notion.so/workspace/<32碼ID>?v=...`，取出 32 碼部分即可。

### 3. 本機開發

```bash
npm install
npm run dev
# 開啟 http://localhost:3000
```

### 4. 部署到 Vercel

```bash
# 方法 A：Vercel CLI
npx vercel

# 方法 B：GitHub 連結
# 1. 將此專案推上 GitHub
# 2. 至 vercel.com 匯入 repo
# 3. 在 Vercel 設定頁填入環境變數（同 .env.local 內容）
# 4. 部署完成
```

**Vercel 環境變數需手動複製 `.env.local` 所有項目**（不要上傳 .env.local 檔案本身）。

---

## Notion 資料庫 ID 對照表

這些 ID 已預先填入 `.env.example`，是你的 Notion 工作區中已建立的資料庫：

| 資料庫 | ID |
|---|---|
| 交易紀錄 | `efeec7d17c1647f4901ea34d5bb25c72` |
| 資金進出 | `93d3c5d202c34952b26dd60943129a0c` |
| 持股清單 | `da55c763359b42edb985b4dfdc9d41f6` |
| 每日資產快照 | `cd7bd1299dd24c33a030f239c257b481` |

---

## 目錄結構

```
src/
├── app/
│   ├── api/
│   │   ├── dashboard/route.ts    # 主要資料 API（彙總所有資料）
│   │   ├── holdings/route.ts     # 持股列表 + 即時/快取價格
│   │   ├── transactions/route.ts # 交易紀錄
│   │   ├── cashflow/route.ts     # 資金進出 + 現金餘額
│   │   ├── snapshot/route.ts     # GET: 歷史快照 / POST: 寫入當日快照
│   │   └── prices/route.ts       # GET: 快取狀態 / POST: 強制刷新價格
│   ├── layout.tsx
│   ├── page.tsx                  # Dashboard 主頁
│   └── globals.css
├── components/
│   ├── dashboard/
│   │   ├── Header.tsx            # 頂部 Header（刷新、主題切換）
│   │   ├── StatCard.tsx          # 統計數字卡片
│   │   ├── AssetChart.tsx        # 資產走勢圖
│   │   ├── DistributionChart.tsx # 資產分布圓餅圖
│   │   ├── HoldingsTable.tsx     # 持股清單表格
│   │   └── TransactionList.tsx   # 最近交易列表
│   └── ui/
│       ├── ThemeToggle.tsx
│       └── Skeleton.tsx
├── lib/
│   ├── notion/
│   │   ├── client.ts             # Notion SDK 客戶端
│   │   ├── helpers.ts            # 屬性讀取工具函數
│   │   └── queries.ts            # 所有資料庫查詢（含自動分頁）
│   ├── prices/
│   │   ├── types.ts              # PriceProvider 抽象介面
│   │   ├── yahoo.ts              # Yahoo Finance 實作
│   │   └── cache.ts              # 15 分鐘記憶體快取層
│   ├── calculator.ts             # 資產計算、損益計算、格式化工具
│   └── utils.ts                  # cn() 工具函數
└── types/
    └── index.ts                  # 全域 TypeScript 型別定義
```

---

## 價格策略（第 3 階段設計）

### 現行策略（穩定優先）

```
使用者開啟 Dashboard
    ↓
API 查詢持股清單（Notion）
    ↓
檢查記憶體快取（15 分鐘有效）
    ├─ 命中 → 直接回傳快取價格
    └─ 未命中 → 向 Yahoo Finance 批次取價
                ├─ 成功 → 寫入快取，標記 source: "daily"
                └─ 失敗 → 使用均成本作為 fallback，標記 source: "fallback"
```

### 快取設定

| 設定項 | 值 |
|---|---|
| 快取有效期 | 15 分鐘 |
| 快取層級 | Node.js module-level（serverless warm instance）|
| Fallback 策略 | 使用 Notion 中記錄的均成本 |
| 快取清除 | 手動點擊「刷新價格」按鈕 |

### 每日快照（Vercel Cron）

- 時間：每週一到週五，09:00 UTC（= 台灣時間 17:00，收盤後）
- 設定位置：`vercel.json` → `crons`
- 端點：`POST /api/snapshot`（需帶 `Authorization: Bearer <CRON_SECRET>`）
- 免費方案限制：每天最多 2 次 cron 執行，已符合需求

---

## 升級為 5 分鐘更新（未來選項）

若要升級為每 5 分鐘自動更新，需變更：

1. **快取 TTL**：`src/lib/prices/types.ts` → 將 `CACHE_TTL_MS` 改為 `5 * 60 * 1000`
2. **Vercel Cron**：`vercel.json` → schedule 改為 `"*/5 * * * *"`（需 Pro 方案，$20/月）
3. **替換 Provider**：`src/lib/prices/yahoo.ts` → 實作相同介面，換成 Finnhub 或 Polygon.io
4. **外部快取**（選配）：若需要跨 serverless instance 共享快取，可改用 Vercel KV（Redis）

---

## 常見問題

**Q: 價格顯示「估算」標籤**
A: Yahoo Finance 取價失敗，目前用均成本代替。可點「刷新價格」重試，或確認股票代號格式正確（台股不需加 .TW）。

**Q: 每日快照沒有自動寫入**
A: 確認 Vercel 專案中有設定 `CRON_SECRET` 環境變數，且 Notion Integration 有對快照資料庫的寫入權限。

**Q: 資產曲線沒有資料**
A: 需要在 Notion「每日資產快照」資料庫中有至少 2 筆資料（或讓 Cron 自動寫入幾天後再看）。

**Q: 台股代號怎麼填**
A: 直接填數字代號，例如 `2330`（不需加 .TW）。系統會自動加上後綴向 Yahoo Finance 查詢。

---

## 技術棧

- **框架**：Next.js 14 App Router + TypeScript
- **樣式**：Tailwind CSS（自訂 Design Token）
- **圖表**：Recharts
- **主題**：next-themes
- **資料來源**：Notion API（@notionhq/client）
- **股價來源**：Yahoo Finance（非官方，免費）
- **部署**：Vercel（免費方案）
