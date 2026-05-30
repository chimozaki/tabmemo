# 📒 Tab Memo PWA ver1.1.0

---

## 🇯🇵 日本語

### 概要
Tab Memo は、カテゴリタブでメモを切り替えて管理できる PWA です。  
ビルド不要で、`index.html` を開くだけで動作します。  
オフラインでも使える設計です。

### 主な機能
- 📂 カテゴリタブ切り替え（横スクロール・スワイプ対応）
- 📝 メモ作成・編集・削除（タイトル + 本文）
- 🔎 全カテゴリ横断検索
- 🎨 ライト / ダークテーマ切替
- 💾 JSON バックアップ・復元
- 📶 Service Worker によるオフライン対応

### 使い方
1. このフォルダを開く
2. `index.html` をブラウザで開く
3. 必要ならホーム画面追加（PWA）

### データ保存
- 保存先: `localStorage`
- キー: `tabMemoPwa_v2_0`
- 旧キーから自動マイグレーション対応

### ファイル構成
- `index.html` : UI 本体
- `app.js` : アプリロジック
- `style.css` : スタイル定義
- `sw.js` : Service Worker
- `manifest.json` : PWA マニフェスト
- `icon.svg` / `icon-maskable.svg` : アイコン

### リリース状態
現在の正式版は **ver1.1.0** です。

---

## 🇬🇧 English

### Overview
Tab Memo is a PWA that lets you organize memos with category tabs.  
No build step is required; just open `index.html`.  
It is designed to work offline.

### Features
- 📂 Category tabs (horizontal scroll + swipe support)
- 📝 Create, edit, and delete memos (title + body)
- 🔎 Search across all categories
- 🎨 Light / dark theme toggle
- 💾 JSON backup and restore
- 📶 Offline support via Service Worker

### Quick Start
1. Open this folder
2. Open `index.html` in your browser
3. Optionally install to home screen (PWA)

### Data Storage
- Storage: `localStorage`
- Key: `tabMemoPwa_v2_0`
- Legacy key migration is supported

### Project Files
- `index.html` : Main UI
- `app.js` : App logic
- `style.css` : Styles
- `sw.js` : Service Worker
- `manifest.json` : PWA manifest
- `icon.svg` / `icon-maskable.svg` : Icons

### Release Status
Current stable release is **ver1.1.0**.

---

## 🇹🇼 繁體中文

### 概要
Tab Memo 是一款可用分類分頁管理備忘錄的 PWA。  
無需建置，直接開啟 `index.html` 即可使用。  
以離線可用為設計核心。

### 主要功能
- 📂 分類分頁切換（支援橫向捲動與滑動）
- 📝 新增、編輯、刪除備忘錄（標題 + 內容）
- 🔎 跨分類全文搜尋
- 🎨 淺色 / 深色主題切換
- 💾 JSON 備份與還原
- 📶 透過 Service Worker 支援離線使用

### 快速開始
1. 開啟此資料夾
2. 用瀏覽器開啟 `index.html`
3. 可選：加入主畫面（PWA）

### 資料儲存
- 儲存位置: `localStorage`
- 金鑰: `tabMemoPwa_v2_0`
- 支援舊版金鑰自動遷移

### 檔案結構
- `index.html` : 主要 UI
- `app.js` : 應用邏輯
- `style.css` : 樣式
- `sw.js` : Service Worker
- `manifest.json` : PWA Manifest
- `icon.svg` / `icon-maskable.svg` : 圖示

### 發行狀態
目前正式版本為 **ver1.1.0**。

---

## 🇪🇸 Español

### Resumen
Tab Memo es una PWA para organizar notas con pestañas por categoría.  
No requiere build; solo abre `index.html`.  
Está diseñada para funcionar también sin conexión.

### Funciones
- 📂 Pestañas por categoría (scroll horizontal y deslizamiento)
- 📝 Crear, editar y eliminar notas (título + contenido)
- 🔎 Búsqueda en todas las categorías
- 🎨 Cambio entre tema claro y oscuro
- 💾 Respaldo y restauración en JSON
- 📶 Soporte offline mediante Service Worker

### Inicio rápido
1. Abre esta carpeta
2. Abre `index.html` en el navegador
3. Opcional: instalar en pantalla de inicio (PWA)

### Almacenamiento
- Almacenamiento: `localStorage`
- Clave: `tabMemoPwa_v2_0`
- Compatible con migración automática desde claves antiguas

### Estructura del proyecto
- `index.html` : UI principal
- `app.js` : Lógica de la app
- `style.css` : Estilos
- `sw.js` : Service Worker
- `manifest.json` : Manifiesto PWA
- `icon.svg` / `icon-maskable.svg` : Iconos

### Estado de lanzamiento
La versión estable actual es **ver1.1.0**.

