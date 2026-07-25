# 📒 TabMemo
![Tab Memo](tabmemo_exsample.png)
---

## 🇯🇵 日本語

### 概要
Tab Memo は、カテゴリタブでメモを切り替えて管理できる PWA です。  
`start_tabmemo.bat` から起動すると、ブラウザに依存しないローカルJSONへ自動保存します。  
`index.html` を直接開く従来方式も利用できます。  
オフラインでも使える設計です。

### 主な機能
- 📂 カテゴリタブ切り替え（横スクロール・スワイプ対応）
- 📝 メモ作成・編集・削除（タイトル + 本文）
- 🔎 全カテゴリ横断検索
- 🎨 ライト / ダークテーマ切替
- 💾 JSON バックアップ・復元
- 📶 Service Worker によるオフライン対応

### 使い方
1. `start_tabmemo.bat` をダブルクリック
2. 自動で開く `http://localhost:4174/` を使用
3. 以前 `index.html` を直接使っていた場合、初回だけJSONバックアップを「復元」します

### データ保存
- 本データ: `data/tabmemo-data.json`
- 直前版: `data/tabmemo-data.previous.json`
- ブラウザキャッシュ: `localStorage`（キー: `tabMemoPwa_v2_0`）
- 別ブラウザでも、同じBATから起動すれば共通のローカルJSONを読み込みます
- `index.html` を直接開いた場合はブラウザ保存のみで動作します

### ファイル構成
- `index.html` : UI 本体
- `app.js` : アプリロジック
- `style.css` : スタイル定義
- `sw.js` : Service Worker
- `manifest.json` : PWA マニフェスト
- `icon.svg` / `icon-maskable.svg` : アイコン

### リリース状態
現在の正式版は **ver1.3.0** です。

## ☕ Support

このプロジェクトが役に立った場合は、Ko-fiで今後の開発を応援していただけると嬉しいです。

☕ https://ko-fi.com/puniq

ご支援ありがとうございます！

---

## 🇬🇧 English

### Overview
Tab Memo is a PWA that lets you organize memos with category tabs.  
Launch with `start_tabmemo.bat` to automatically save to a browser-independent local JSON file.  
Direct `index.html` use remains available as a browser-storage fallback.  
It is designed to work offline.

### Features
- 📂 Category tabs (horizontal scroll + swipe support)
- 📝 Create, edit, and delete memos (title + body)
- 🔎 Search across all categories
- 🎨 Light / dark theme toggle
- 💾 JSON backup and restore
- 📶 Offline support via Service Worker

### Quick Start
1. Double-click `start_tabmemo.bat`
2. Use the automatically opened `http://localhost:4174/`
3. If you previously opened `index.html` directly, restore your JSON backup once

### Data Storage
- Primary data: `data/tabmemo-data.json`
- Previous version: `data/tabmemo-data.previous.json`
- Browser cache: `localStorage` (key: `tabMemoPwa_v2_0`)
- Browsers share the same local JSON when launched through the BAT file
- Direct `index.html` use falls back to browser-only storage

### Project Files
- `index.html` : Main UI
- `app.js` : App logic
- `style.css` : Styles
- `sw.js` : Service Worker
- `manifest.json` : PWA manifest
- `icon.svg` / `icon-maskable.svg` : Icons

### Release Status
Current stable release is **ver1.3.0**.

## ☕ Support

If you find this project useful and would like to support future development, you can support me on Ko-fi.

☕ https://ko-fi.com/puniq

Thank you for your support!
---

## 🇹🇼 繁體中文

### 概要
Tab Memo 是一款可用分類分頁管理備忘錄的 PWA。  
使用 `start_tabmemo.bat` 啟動時，資料會自動儲存到不依賴瀏覽器的本機 JSON。  
仍可直接開啟 `index.html`，此時會使用瀏覽器儲存空間。  
以離線可用為設計核心。

### 主要功能
- 📂 分類分頁切換（支援橫向捲動與滑動）
- 📝 新增、編輯、刪除備忘錄（標題 + 內容）
- 🔎 跨分類全文搜尋
- 🎨 淺色 / 深色主題切換
- 💾 JSON 備份與還原
- 📶 透過 Service Worker 支援離線使用

### 快速開始
1. 雙擊 `start_tabmemo.bat`
2. 使用自動開啟的 `http://localhost:4174/`
3. 首次使用時，請從既有備份還原資料

### 資料儲存
- 主要資料: `data/tabmemo-data.json`
- 上一版本: `data/tabmemo-data.previous.json`
- 瀏覽器快取: `localStorage`（金鑰: `tabMemoPwa_v2_0`）
- 透過 BAT 啟動時，不同瀏覽器會共用同一個本機 JSON

### 檔案結構
- `index.html` : 主要 UI
- `app.js` : 應用邏輯
- `style.css` : 樣式
- `sw.js` : Service Worker
- `manifest.json` : PWA Manifest
- `icon.svg` / `icon-maskable.svg` : 圖示

### 發行狀態
目前正式版本為 **ver1.3.0**。

## ☕ Support

如果這個專案對您有幫助，歡迎透過 Ko-fi 支持後續開發。

☕ https://ko-fi.com/puniq

感謝您的支持！
---

## 🇪🇸 Español

### Resumen
Tab Memo es una PWA para organizar notas con pestañas por categoría.  
Al iniciarla con `start_tabmemo.bat`, los datos se guardan automáticamente en un JSON local independiente del navegador.  
También se puede abrir `index.html` directamente usando el almacenamiento del navegador.  
Está diseñada para funcionar también sin conexión.

### Funciones
- 📂 Pestañas por categoría (scroll horizontal y deslizamiento)
- 📝 Crear, editar y eliminar notas (título + contenido)
- 🔎 Búsqueda en todas las categorías
- 🎨 Cambio entre tema claro y oscuro
- 💾 Respaldo y restauración en JSON
- 📶 Soporte offline mediante Service Worker

### Inicio rápido
1. Haz doble clic en `start_tabmemo.bat`
2. Usa `http://localhost:4174/`, que se abrirá automáticamente
3. La primera vez, restaura los datos desde tu copia de seguridad

### Almacenamiento
- Datos principales: `data/tabmemo-data.json`
- Versión anterior: `data/tabmemo-data.previous.json`
- Caché del navegador: `localStorage` (clave: `tabMemoPwa_v2_0`)
- Los navegadores comparten el mismo JSON local al iniciar mediante el BAT

### Estructura del proyecto
- `index.html` : UI principal
- `app.js` : Lógica de la app
- `style.css` : Estilos
- `sw.js` : Service Worker
- `manifest.json` : Manifiesto PWA
- `icon.svg` / `icon-maskable.svg` : Iconos

### Estado de lanzamiento
La versión estable actual es **ver1.3.0**.

## ☕ Support

Si este proyecto te resulta útil y deseas apoyar su desarrollo futuro, puedes apoyarme en Ko-fi.

☕ https://ko-fi.com/puniq

¡Muchas gracias por tu apoyo!
