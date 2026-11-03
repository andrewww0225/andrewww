# evidence-mirror

GitHub Pages：https://andrewww0225.github.io/andrewww/（repo andrewww0225/andrewww，main 分支直接上線）

- 根目錄 `index.html`、`frag/`、`evidence-table_backup.html` 是論文證據對照表，由 `D:/學校/專題/查證工具/sync.pl` 從備份同步過來，不要在這裡直接改。
- `quiz/` 是測驗網站「土豆集散地」，下面都是它的說明。

## quiz/ 結構

| 檔案 | 內容 |
|---|---|
| `index.html` | 只有骨架，依序載入下面的檔案 |
| `style.css` | 全部樣式（含深色模式） |
| `app.js` | 題庫註冊 `QUIZ.register`、路由、首頁／科目頁／練習／模擬考／錯題本／瀏覽題庫、`expHtml()` 解析 |
| `eggs.js` | 彩蛋：隨機冒圖、音效 `EGG_SOUNDS`、音量、各圖比例面板 |
| `data/subjects.js` | 科目清單，順序＝首頁順序 |
| `data/<科目>-ch<N>.js` | 一章一檔：`QUIZ.register({group, groupName, id, name, slides?, questions:[{q, opts, ans:"B", exp?}]})`，題目照課本原題號排 |
| `data/mat.js` | 彩蛋圖片清單（靜態網站讀不到資料夾，新增圖片要加在這） |
| `data/essays.js` | 簡答題重點 `QUIZ_ESSAYS[科目id] = [{q, a(HTML), src}]`；有資料的科目才會在科目頁出現入口（`#/s/<科目>/essay`）。答案只照課本照片寫，不從選擇題推 |
| `data/guesses.js` | Claude 推測之申論題 `QUIZ_GUESSES[科目id] = [{ch, q, a(HTML), src, star?}]`，入口 `#/s/<科目>/guess`，和簡答題共用 `renderEssay()`；只照課本照片寫 |
| `mat/` | 彩蛋圖片與音效 |
| `slides/<id>/p<N>.jpg` | 投影片頁圖；資料檔有 `slides` 時，exp 裡的「投影片 p16、p2～3」會顯示對應圖片 |

- 路由：`#/`、`#/s/<科目>`、`#/s/<科目>/(practice|exam|wrong|browse)`。
- 設定存在 localStorage：`quiz:prefs`；錯題本也存在瀏覽器裡。

## 工具（tools/，都用 Windows PowerShell 5.1 跑；本機沒有 node/python）

- 檢查題庫：`powershell -NoProfile -ExecutionPolicy Bypass -File tools\check-bank.ps1`
  - 用無頭 Edge 跑 `tools/check.html`（直接用網站的 app.js）。
  - 印出各章題數、答案分布、格式錯誤、重複題、缺少的投影片圖。
  - 新增或修改題庫後先跑這個，不用開瀏覽器。
  - 要用 PowerShell 工具跑（先設 `[Console]::OutputEncoding = [Text.Encoding]::UTF8`）；從 Bash 呼叫會印「Could not read report」。
- 投影片轉圖：`powershell -NoProfile -ExecutionPolicy Bypass -File tools\pdf-pages.ps1 -Pdf <pdf> -OutDir quiz\slides\<id> -Pages "3,14,15"`
  - 用 Windows 內建 PDF 引擎，輸出 1280px jpg。
  - 「投影片 pN」＝PDF 第 N 頁。
- push：`powershell -NoProfile -ExecutionPolicy Bypass -File tools\push.ps1`
  - 只印一行 `PUSH OK remote = local = xxxxxxx`。
  - 只有 Andrew 說 push 才跑。用 Bash 工具跑即可（run_in_terminal 會擋含中文的路徑）。

## 改網站的習慣

- 只讀要改的那個檔案的相關段落（`grep -n` 定位），不要整份讀。
- 驗證：
  - 小改動（文字、數字）用 grep 確認就好。
  - 有畫面或互動的改動才開預覽：preview_start `quiz`（`.claude/launch.json`，python http.server 埠 8765），網址 http://localhost:8765/quiz/。
  - 預覽會吃到舊快取：先 `fetch(檔名, {cache:'reload'})` 再重新整理。
- 換掉音檔內容時，要把 `eggs.js` 的 `EGG_SOUND_VER` 加 1，不然瀏覽器會播舊檔。
- GitHub Pages 快取約 10 分鐘，push 後舊訪客最多 10 分鐘才看到新版。
- commit 可以直接做；push 一定等 Andrew 說。
