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
