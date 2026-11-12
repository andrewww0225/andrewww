# 彈力帶訓練

給自己用的上半身彈力帶訓練指引：照著做、記錄、看進度。純 HTML、CSS 和原生 JavaScript，沒有框架、沒有建置步驟、沒有後端，也不會連到任何外部服務。

## 功能

- 首頁依最近一次的紀錄建議今天做訓練日 A 還是 B，可以手動切換。
- 訓練畫面一次顯示一個動作：用哪條帶子、目標組數與次數、做法、容易犯的錯。每組可以打勾、填實際次數、選「還剩幾下餘力」。
- 每次開始前會先跳出檢查清單。
- 打勾後自動開始組間休息倒數，結束時有提示音和震動。
- 每一組都做到次數上限、而且餘力都在 2 下以內，下次訓練會提示「可以加難度」。
- Tabata 計時器（20 秒動作、10 秒休息、8 個循環為一輪，都可以改）。
- 歷史紀錄、每個動作的總次數折線圖、每週訓練次數長條圖。
- 設定頁可以編輯動作、組數、休息秒數，匯出與匯入 JSON，清除資料。
- 可以加到手機主畫面，離線也能用。

## 檔案

| 檔案 | 內容 |
|---|---|
| `index.html` | 骨架 |
| `style.css` | 樣式（淺色與深色） |
| `data.js` | 預設動作、訓練日、Tabata 預設值、說明文字 |
| `device.js` | 螢幕恆亮、提示音、震動 |
| `charts.js` | SVG 折線圖與長條圖 |
| `app.js` | 狀態、路由、各頁面、計時器、匯出匯入 |
| `sw.js` | service worker（離線快取） |
| `manifest.webmanifest`、`icons/` | 加到主畫面用的設定與圖示 |

## 在本機打開

service worker 和螢幕恆亮只能在 `https://` 或 `http://localhost` 下運作，所以請用本機伺服器開，不要直接點兩下 `index.html`（直接開也能用，但不能離線、不能安裝、螢幕不會保持開啟）。

在這個資料夾裡擇一執行：

```
python -m http.server 8000
```

```
npx serve -l 8000
```

然後用瀏覽器開 <http://localhost:8000/>。

沒有 Python 和 Node 的 Windows 電腦，可以用 Windows PowerShell 起一個最簡單的伺服器：

```powershell
$l = [Net.HttpListener]::new(); $l.Prefixes.Add('http://localhost:8000/'); $l.Start()
$types = @{'.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.webmanifest'='application/manifest+json'; '.svg'='image/svg+xml'; '.png'='image/png'}
while ($l.IsListening) {
  $c = $l.GetContext(); $p = $c.Request.Url.LocalPath.TrimStart('/'); if (-not $p) { $p = 'index.html' }
  $f = Join-Path (Get-Location) $p
  if (Test-Path $f -PathType Leaf) { $b = [IO.File]::ReadAllBytes($f); $c.Response.ContentType = $types[[IO.Path]::GetExtension($f)]; $c.Response.OutputStream.Write($b, 0, $b.Length) } else { $c.Response.StatusCode = 404 }
  $c.Response.Close()
}
```

（按 Ctrl+C 停止。這段指令我沒有在 Windows 上實際跑過，只在 Linux 上用 Python 伺服器測過網站本身。）

要在同一個 Wi-Fi 下用手機測試，手機連 `http://電腦的IP:8000/` 可以看到畫面，但因為不是 HTTPS，手機上不能安裝成 app、螢幕也不會保持開啟。要測完整功能請部署到 GitHub Pages。

## 部署到 GitHub Pages

這個資料夾放在 `andrewww0225/andrewww` repo 的 `fitness/` 底下。這個 repo 的 GitHub Pages 是 main 分支直接上線，所以：

1. 把 `fitness/` 資料夾 commit 並合併（或 push）到 `main`。
2. 等一到兩分鐘，打開 <https://andrewww0225.github.io/andrewww/fitness/>。
3. 手機加到主畫面：
   - Android Chrome：右上角選單 →「加到主畫面」或「安裝應用程式」。
   - iPhone Safari：分享按鈕 →「加入主畫面」。
4. 加到主畫面後先連著網路開一次，之後就能離線使用。

如果要放到別的 repo：把這個資料夾的內容放進 repo，到 repo 的 Settings → Pages，Source 選「Deploy from a branch」，選好分支和資料夾後儲存即可。所有路徑都是相對路徑，放在任何子目錄都能運作。

### 更新版本

改完檔案 push 上去就好。service worker 會先顯示快取裡的舊版，同時在背景抓新版，所以更新後要**重新開啟兩次**才會看到新內容（GitHub Pages 本身還有大約 10 分鐘的快取）。如果新增或改名了檔案，記得同步修改 `sw.js` 裡的 `ASSETS` 清單，並把 `CACHE` 的版本號加 1。

## 資料與備份

- 所有資料存在瀏覽器的 localStorage，鍵是 `bandfit:data`。清除瀏覽資料、移除主畫面的 app、或換手機，資料就會不見。
- 請定期到「設定 → 匯出 JSON」備份；換裝置時用「匯入 JSON」還原。匯入會取代目前的所有資料。
- iPhone 上，Safari 裡和加到主畫面的 app 是兩份各自獨立的資料。

資料結構：

```js
{
  version: 1,
  settings: { restSec: 75, sound: true, vibrate: true, theme: "auto" },
  tabata: { work: 20, rest: 10, cycles: 8, rounds: 2, roundRest: 60, moves: ["開合跳", "…"] },
  exercises: [ { id: "lateral", name: "側平舉", how: "…", mistakes: "…" } ],
  plans: {
    A: { title: "肩膀和上背", items: [ { exId: "lateral", band: 5, sets: 3, min: 12, max: 20 } ] },
    B: { title: "胸和肩", items: [ /* … */ ] }
  },
  sessions: [ {
    id: "s1731400000000", date: "2026-11-12", startedAt: 1731400000000, endedAt: 1731401500000, plan: "A",
    items: [ { exId: "lateral", name: "側平舉", band: 5, min: 12, max: 20, targetSets: 3,
               sets: [ { done: true, reps: 15, rir: 2 } ] } ]   // rir 是餘力：0、1、2、3（3 代表 3 以上）
  } ],
  active: null   // 進行中的訓練；重新整理或關掉再開都可以接著做
}
```

## 瀏覽器功能的限制

三個功能都先偵測、不支援就安靜略過，不影響記錄。

- **螢幕恆亮（Screen Wake Lock API）**：需要 HTTPS 或 localhost。MDN 標示為 2025 年 3 月起各主流瀏覽器的最新版都支援，較舊的瀏覽器沒有。切到別的 app 時系統會自動釋放，切回來時程式會重新取得。手機開啟省電模式時系統可能拒絕。
- **提示音（Web Audio API）**：瀏覽器規定要先有點按才能出聲，所以程式在你第一次點畫面時啟用。iPhone 切到靜音模式時可能聽不到。
- **震動（Vibration API）**：MDN 標示為「部分瀏覽器不支援」。Android 的 Chrome 可以；iPhone 的 Safari 沒有這個功能，所以 iPhone 上只有提示音。說明頁最下面會顯示這臺裝置三項功能是否可用。
- 計時器在螢幕關閉或切到背景時會被瀏覽器暫緩，提示音可能延後到回來時才響；倒數本身是用時間戳記算的，回來時數字仍然正確。

## 訓練原則

- 不需要每組都力竭，目標是做到再多做 1 到 2 下就會失敗或姿勢跑掉。
- 最後一組可以更接近力竭。
- 動作變形、肩膀聳起來就停。
- 推和拉的量要大致平衡，所以 B 日有胸推也不能省略划船和拉開。
