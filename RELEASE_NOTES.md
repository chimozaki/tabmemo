# 🎉 Tab Memo ver1.4.0 Release Notes

## ✨ 機能追加 / New Features

Tab Memo ver1.4.0 は、誤削除と未保存によるデータ損失を防ぎ、モバイル操作を改善するアップデートです。
Tab Memo ver1.4.0 protects against accidental deletion and unsaved edits while improving mobile usability.

---

## ✅ 追加・改善内容 / Updates

- 🗑 メモを削除するとゴミ箱へ移動 / Move deleted memos to Trash
- 📁 カテゴリを中のメモごとゴミ箱へ移動 / Move deleted categories and their memos to Trash
- ♻️ ゴミ箱からメモ・カテゴリを個別に復元 / Restore individual memos and categories from Trash
- ❌ 個別の完全削除と「ゴミ箱を空にする」に対応 / Permanently delete individual items or empty Trash
- 🔢 バックアップ・復元の横にゴミ箱と件数を常時表示 / Show Trash and its item count beside Backup and Restore
- 🛡 メモを変更して閉じる際に「保存して閉じる・保存せず閉じる・キャンセル」を表示 / Offer Save, Discard, or Cancel when closing an edited memo
- 🚪 ブラウザ更新・終了時にも未保存変更を警告 / Warn about unsaved edits when refreshing or leaving the page
- 🔒 メモ編集・カテゴリ一覧・カテゴリ名入力を明示ボタンでのみ閉じる仕様へ変更 / Require explicit buttons to close memo, category-list, and category-name dialogs
- ⌨️ モーダル内にキーボードフォーカスを維持 / Keep keyboard focus inside active dialogs
- 📋 コピー完了通知を大きく見やすいデザインへ変更 / Make copy feedback larger and easier to notice
- 📱 640px以下でタイトルと操作ボタンを上下段に分離 / Split the title and action controls into rows at 640px and below
- 📱 320px・390px幅でヘッダー、ボトム操作、追加ボタンが重ならないよう調整 / Prevent overlap among the header, bottom actions, and add button at 320px and 390px widths
- 🖥️ 起動中のコマンド画面を `TabMemo - Local Server` と識別できるよう改善 / Label the running command window as `TabMemo - Local Server`

---

## 🛠 不具合修正 / Fixes

- 📌 固定メモを編集後に閉じてもピン留めが外れないよう修正 / Preserve pin state after editing a pinned memo
- 💾 タブ移動では保存処理を実行せず、テーマ変更時も不要な保存完了トーストを出さないよう修正 / Avoid saving on tab switches and suppress unnecessary save-complete toasts after theme changes
- 🔕 通常保存時の不要なトースト通知を廃止 / Remove routine save toast notifications
- 🌐 `index.html` 直接起動や静的ホスティングで、ブラウザ保存へ静かに切り替えるよう変更 / Silently fall back to browser storage for direct `index.html` use and static hosting
- ⚠️ 画面下部の常設「ブラウザ保存のみ」警告を廃止 / Remove the persistent browser-only warning from the bottom of the screen
- 🖱️ モーダル背景のクリックで入力画面が意図せず閉じる問題を解消 / Prevent dialogs from closing when their backdrop is clicked

---

## 🔄 データ互換性 / Data Compatibility

- 既存のver1.3.0データは自動的にver1.4.0形式へ移行されます / Existing ver1.3.0 data is migrated automatically
- 新しい `trash` データ領域は初回読み込み時に自動追加されます / The new `trash` data area is added automatically on first load
- ゴミ箱の内容もローカルJSON、ブラウザ保存、JSONバックアップに含まれます / Trash contents are included in local JSON, browser storage, and JSON backups
- 保存キー `tabMemoPwa_v2_0` は変更していません / The storage key `tabMemoPwa_v2_0` remains unchanged

---

## 🛠 技術情報 / Technical Notes

- アプリ内・manifest・Service Workerを `ver1.4.0` に更新 / Updated the app, manifest, and Service Worker to `ver1.4.0`
- Service Workerキャッシュ名を `tab-memo-v1-4-0` に更新 / Updated the Service Worker cache name to `tab-memo-v1-4-0`
- 保存APIが404を返す静的環境ではエラー扱いにせずブラウザ保存を利用 / Use browser storage without an error when the save API is unavailable on static hosting
- メモ・カテゴリの削除確認は「ゴミ箱へ移動」と分かる文言へ変更 / Clarified deletion prompts to say items are moved to Trash

---

## ⚠️ 既知の制限 / Known Limitations

- `index.html` を直接開いた場合、データはそのブラウザ内に保存されます / Direct `index.html` use stores data in that browser
- ローカルJSONをブラウザ間で共有する場合は `start_tabmemo.bat` を使用してください / Use `start_tabmemo.bat` to share local JSON data across browsers
- ゴミ箱は自動削除されません。必要に応じて手動で空にしてください / Trash is not deleted automatically; empty it manually when needed
- Google Driveバックアップは現在未実装です / Google Drive backup is not implemented yet

---

# 🎉 Tab Memo ver1.3.0 Release Notes

## ✨ 機能追加 / New Features

Tab Memo ver1.3.0 は、ブラウザに依存しないローカルJSON保存に対応したアップデートです。  
Tab Memo ver1.3.0 introduces browser-independent local JSON storage.

既定ブラウザを変更しても、同じパソコン上のメモデータを引き続き利用できます。  
Your memo data can now be shared across browsers on the same computer.

---

## ✅ 追加・改善内容 / Updates

- 💾 メモデータを `data/tabmemo-data.json` へ自動保存 / Automatically save memo data to `data/tabmemo-data.json`
- 🕘 保存前の状態を `data/tabmemo-data.previous.json` に保持 / Keep the previous state in `data/tabmemo-data.previous.json`
- 🌐 異なるブラウザでも同じローカルJSONを共有 / Share the same local JSON data across different browsers
- 🗃️ `localStorage` を表示用・障害時の予備キャッシュとして継続利用 / Continue using `localStorage` as a fallback browser cache
- 🚀 `start_tabmemo.bat` によるワンクリック起動に対応 / Added one-click startup with `start_tabmemo.bat`
- 🔗 固定URL `http://localhost:4174/` から起動 / Launch from the fixed URL `http://localhost:4174/`
- 📌 ライト／ダークモードでピン留めメモのデザインを統一 / Unified pinned memo styling across light and dark modes
- 🎨 ピン留めメモに背景グラデーション・左端アクセント・ピンボタン強調を追加 / Added a background gradient, left accent, and emphasized pin button
- 💡 保存中・保存完了を自動で消えるフローティング通知で表示 / Show temporary floating notifications while saving and after completion
- ⚠️ `index.html` 直接起動時の警告を小型チップで表示し、クリックで詳細を展開 / Show a compact expandable warning when opening `index.html` directly
- 🖼️ Tab MemoアイコンをブラウザタブのFaviconとして設定 / Added the Tab Memo icon as the browser Favicon

---

## 🛠 不具合修正 / Fixes

- 🖱️ メモタイトルを枠外までドラッグ選択すると編集画面が閉じる問題を修正 / Fixed the memo editor closing when dragging title text outside the input
- 📝 メモ本文・カテゴリ名でも安全にドラッグ選択できるよう改善 / Improved drag selection safety for memo bodies and category names
- 🪟 メモ編集・カテゴリ名・カテゴリ一覧・バックアップ・追加メニューの背景判定を共通化 / Unified safe backdrop handling across dialogs and menus
- 📂 カテゴリ複数選択中に保存通知が操作を妨げる問題を改善 / Prevented storage notifications from covering category-selection controls

---

## 🔄 旧データからの移行 / Migration

1. 以前使用していたブラウザで旧Tab Memoを開く / Open the previous Tab Memo in the browser you used before
2. 「💾バックアップ」からJSONを保存する / Export your data using the Backup button
3. `start_tabmemo.bat` を実行する / Run `start_tabmemo.bat`
4. 新しいTab Memoで「⏳復元」を押し、保存したJSONを選択する / Restore the exported JSON in the new Tab Memo
5. 「✅ ローカルファイルへ保存しました」と表示されるまで待つ / Wait for the local file save notification

移行後は、異なるブラウザから起動しても同じデータが表示されます。  
After migration, the same data will be available in other browsers.

---

## 🛠 技術情報 / Technical Notes

- ローカル保存サーバー: Node.js標準モジュールのみで動作 / Local storage server uses only Node.js built-in modules
- 本データ: `data/tabmemo-data.json` / Primary data file: `data/tabmemo-data.json`
- 直前版: `data/tabmemo-data.previous.json` / Previous data file: `data/tabmemo-data.previous.json`
- ブラウザ保存キー `tabMemoPwa_v2_0` は継続利用 / Existing browser storage key `tabMemoPwa_v2_0` remains unchanged
- Service Workerをネットワーク優先・キャッシュフォールバック方式へ変更 / Changed the Service Worker to network-first with cache fallback

---

## ⚠️ 既知の制限 / Known Limitations

- 通常利用では `start_tabmemo.bat` から起動してください / Use `start_tabmemo.bat` for normal operation
- 起動にはNode.jsが必要です / Node.js is required
- `index.html` を直接開いた場合はブラウザ内保存のみになります / Directly opening `index.html` uses browser-only storage
- Tab Memo使用中はローカルサーバーを終了しないでください / Keep the local server running while using Tab Memo
- Google Driveバックアップは現在未実装です / Google Drive backup is not implemented yet

---

# 🎉 Tab Memo ver1.2.0 Release Notes

## ✨ 機能追加 / New Features

Tab Memo ver1.2.0 は、カテゴリとメモの整理操作を強化したアップデートです。  
Tab Memo ver1.2.0 improves category and memo organization workflows.

---

## ✅ 追加・改善内容 / Updates

- 🔀 カテゴリ一覧で2件タップによる並び替えに対応 / Reorder categories by tapping two items to swap them
- ✅ カテゴリ一覧で複数選択と一括削除に対応 / Select multiple categories and delete them in bulk
- 📌 カテゴリ追加ボタンを一覧下部に固定 / Keep the add-category button fixed below the scrolling list
- 🔀 メモ一覧で2件タップによる並び替えに対応 / Reorder memos by tapping two items to swap them
- ✅ メモ一覧で複数選択に対応 / Select multiple memos from the memo list
- 📌 選択したメモの一括ピン留め・ピン解除に対応 / Pin or unpin selected memos in bulk
- 🗑 選択したメモの一括削除に対応 / Delete selected memos in bulk
- 📋 メモコピー時は本文のみコピーするよう変更 / Copy only the memo body, not the title
- 🔎 検索欄を横長に調整し、プレースホルダー文言を改善 / Widened the search field and improved placeholder text
- 🔎 検索中に入力欄外をクリックすると元の画面へ戻るよう改善 / Exit search mode by clicking outside the search field
- 📱 モバイル表示でタイトルが縦に崩れないよう調整 / Prevented the app title from wrapping vertically on mobile
- 📝 カテゴリ名編集中に文字選択で枠外へドラッグしても閉じないよう修正 / Prevent category-name edit modal from closing while selecting text outside the input

---

## 🛠 技術情報 / Technical Notes

- アプリ内バージョン表記を `ver1.2.0` に更新 / Updated in-app version labels to `ver1.2.0`
- `manifest.json` のアプリ名・説明を `ver1.2.0` に更新 / Updated `manifest.json` name and description to `ver1.2.0`
- Service Worker のバージョン表記とキャッシュ名を更新 / Updated Service Worker version label and cache name
- 既存データ保存キー `tabMemoPwa_v2_0` は継続利用 / Existing storage key `tabMemoPwa_v2_0` remains unchanged

---

## ⚠️ 既知の制限 / Known Limitations

- ピン留めメモと通常メモは表示グループが異なるため、並び替え時に同士のみ入れ替え可能です / Pinned and normal memos are displayed in separate groups, so only memos in the same group can be swapped
- Google Drive バックアップは現在 `Coming soon` 表示で未実装です / Google Drive backup is currently marked as `Coming soon` and not implemented yet

---

# 🎉 Tab Memo ver1.1.0 Release Notes

## 🎉 初回リリース / Initial Release

Tab Memo の最初の公開リリースです（バージョン表記は ver1.1.0）。  
First public release of Tab Memo (versioned as ver1.1.0).

---

## ✨ 主な機能 / Features

- 📂 カテゴリタブでメモを整理（横スクロール・スワイプ対応）/ Organize memos with category tabs (horizontal scroll + swipe)
- 📝 メモの作成・編集・削除 / Create, edit, and delete memos
- 📌 ピン留めで重要メモを上部固定 / Pin important memos to the top
- 📋 メモ一覧からワンタップコピー / One-tap copy from the memo list
- 🔍 全カテゴリ横断のキーワード検索 / Keyword search across all categories
- 🎨 ライト / ダークテーマ切替 / Light and dark theme toggle
- 💾 JSONバックアップ / 復元 / JSON backup and restore
- 📶 PWA + Service Worker によるオフライン利用 / Offline support via PWA + Service Worker
- 💽 全データをブラウザにローカル保存（サーバー不要）/ All data is stored locally in the browser (no server required)

---

## 🛠 技術情報 / Technical Notes

- Vanilla JavaScript + HTML + CSS（ビルド不要）/ Vanilla JavaScript + HTML + CSS (no build step)
- メモデータ保存: `localStorage`（キー: `tabMemoPwa_v2_0`）/ Memo data storage: `localStorage` (key: `tabMemoPwa_v2_0`)
- 旧バージョン保存キーからの自動移行対応 / Automatic migration from legacy storage keys
- PWA構成: `manifest.json`, `sw.js` / PWA setup: `manifest.json`, `sw.js`

---

## ⚠️ 既知の制限 / Known Limitations

- ブラウザのストレージ削除やサイトデータ消去を行うとメモは失われます。定期的にバックアップしてください / Memos are lost if browser storage/site data is cleared; back up regularly
- 保存データは端末ローカルのみで、クラウド自動同期はありません / Data is local-only; automatic cloud sync is not available
- Google Drive バックアップは現在 `Coming soon` 表示で未実装です / Google Drive backup is currently marked as `Coming soon` and not implemented yet
