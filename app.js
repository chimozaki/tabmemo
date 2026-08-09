// =============================================
//  Tab Memo 1.4.1
//  GitHub Pages公開・最終バックアップ日時表示
//
//  主な変更:
//  - カテゴリ一覧からメモ編集→保存/キャンセルでモーダルに戻る
//  - カテゴリ名タップ→タブ切り替え（名前変更は📝ボタン経由）
//  - メモカードタップで編集（📝ボタン廃止）
//  - 検索結果カードタップで編集（📝ボタン廃止）
//  - MutationObserver系パッチ削除
//  - resize/orientationchangeでタブ再描画
//  - closeEditor の多重上書きバグを解消
// =============================================

const STORAGE_KEY = "tabMemoPwa_v2_0";
const LEGACY_KEYS = [
  "tabMemoPwaBeta1_8", "tabMemoPwaBeta1_2", "tabMemoPwaBeta1_1",
  "tabMemoPwaBeta1",   "tabMemoPwaV7",      "tabMemoPwaV6",
  "tabMemoPwaV5",      "tabMemoPwaV4Complete"
];
const LOCAL_DATA_API = "./api/data";

const LocalFileStore = {
  available: false,
  lastPayload: null,
  saveChain: Promise.resolve(),

  async load() {
    if (location.protocol === "file:") {
      return { available: false, exists: false, data: null };
    }

    const response = await fetch(LOCAL_DATA_API, { cache: "no-store" });
    // 静的ホスティングでは保存APIが存在しないため、ブラウザ保存へ静かに切り替える。
    if (response.status === 404) {
      return { available: false, exists: false, data: null };
    }
    if (!response.ok) throw new Error(`local data load failed: ${response.status}`);

    const result = await response.json();
    this.available = true;
    return {
      available: true,
      exists: result.exists === true,
      data: result.data ?? null
    };
  },

  remember(snapshot) {
    this.lastPayload = JSON.stringify(snapshot);
  },

  queueSave(snapshot) {
    if (!this.available) return;

    const payload = JSON.stringify(snapshot);
    if (payload === this.lastPayload) return;
    this.lastPayload = payload;

    this.saveChain = this.saveChain
      .catch(() => {})
      .then(async () => {
        const response = await fetch(LOCAL_DATA_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload
        });
        if (!response.ok) throw new Error(`local data save failed: ${response.status}`);
      })
      .catch((error) => {
        this.lastPayload = null;
        console.warn("Tab Memo: local file save error", error);
        setStorageStatus("⚠️ ローカルファイルに保存できませんでした。ブラウザ内には保存済みです。", {
          type: "error",
          persistent: true
        });
      });
  }
};

let data          = load();
let editingIndex  = null;   // 編集中メモのインデックス
let editingCatIdx = null;   // 編集中メモのカテゴリインデックス
let returnToModal = false;  // 編集後にカテゴリモーダルへ戻るか
let isSearchMode  = false;
let touchStartX   = 0;
let touchStartY   = 0;
let swipeIgnore   = false;
let toastShowTimer = null;
let toastHideTimer = null;

let confirmDeleteBusy = false;
let catReorderMode = false;
let catSelectMode = false;
let selectedCatIndexes = new Set();
let catMoveFromIdx = null;
let memoSelectMode = false;
let memoReorderMode = false;
let selectedMemoIndexes = new Set();
let memoSwapFromIdx = null;
let editorInitialValue = { title: "", text: "" };

/**
 * 「削除しますか？」の軽量バーでネイティブ confirm を代替する。
 */
function confirmDelete(cb, {
  message = "本当に削除しますか？",
  confirmLabel = "削除する",
  onSave = null,
  saveLabel = "保存して閉じる"
} = {}) {
  if (confirmDeleteBusy) return;
  confirmDeleteBusy = true;

  const bar    = document.getElementById("confirmBar");
  const btnCx  = document.getElementById("confirmBarCancel");
  const btnDel = document.getElementById("confirmBarDelete");
  const btnSave = document.getElementById("confirmBarSave");
  const msg    = document.getElementById("confirmBarMessage");
  msg.textContent = message;
  btnDel.textContent = confirmLabel;
  btnSave.textContent = saveLabel;
  btnSave.classList.toggle("hidden", typeof onSave !== "function");

  const cleanup = () => {
    bar.classList.add("hidden");
    btnCx.removeEventListener("click", onCancel);
    btnDel.removeEventListener("click", onConfirm);
    btnSave.removeEventListener("click", onSaveAndClose);
    document.removeEventListener("keydown", onKeyDown);
    confirmDeleteBusy = false;
  };

  const finish = (ok) => {
    cleanup();
    cb(ok);
  };

  function onCancel() { finish(false); }
  function onConfirm() { finish(true); }
  function onSaveAndClose() {
    cleanup();
    onSave();
  }

  function onKeyDown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      finish(false);
    }
  }

  btnCx.addEventListener("click", onCancel);
  btnDel.addEventListener("click", onConfirm);
  if (typeof onSave === "function") btnSave.addEventListener("click", onSaveAndClose);
  document.addEventListener("keydown", onKeyDown);
  bar.classList.remove("hidden");
}

// ─────────────────────────────────────────────
//  データ正規化
// ─────────────────────────────────────────────
function normalizeData(d) {
  if (!d) return null;
  if (!Array.isArray(d.cats) || !Array.isArray(d.memos)) return null;

  d.cats = d.cats.map(cat => {
    if (typeof cat === "string") return cat;
    if (typeof cat === "object" && cat !== null) return typeof cat.name === "string" ? cat.name : "";
    return "";
  });

  while (d.memos.length < d.cats.length) d.memos.push([]);
  if (d.memos.length > d.cats.length) d.memos.length = d.cats.length;

  d.memos = d.memos.map(list =>
    (Array.isArray(list) ? list : []).map(m => {
      if (typeof m === "string") {
        return { title: "", text: m, created: new Date().toLocaleString(), updated: null, pinned: false };
      }
      if (!("title"   in m)) m.title   = "";
      if (!("text"    in m)) m.text    = "";
      if (!("created" in m)) m.created = m.time || new Date().toLocaleString();
      if (!("updated" in m)) m.updated = null;
      if (!("pinned"  in m)) m.pinned  = false;
      delete m.time;
      return m;
    })
  );

  if (!Array.isArray(d.trash)) d.trash = [];
  d.trash = d.trash.filter(item =>
    item && typeof item === "object"
    && typeof item.id === "string"
    && (item.type === "memo" || item.type === "category")
  );

  if (typeof d.active !== "number" || d.active < 0 || d.active >= d.cats.length) d.active = 0;
  if (typeof d.dark !== "boolean") d.dark = false;
  if (typeof d.lastBackupAt !== "string") d.lastBackupAt = null;
  d.version = "1.4.1";
  return d;
}

// ─────────────────────────────────────────────
//  ロード（旧バージョンマイグレーション込み）
// ─────────────────────────────────────────────
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = normalizeData(JSON.parse(raw));
      if (parsed) return parsed;
    }
    for (const key of LEGACY_KEYS) {
      const old = localStorage.getItem(key);
      if (!old) continue;
      const migrated = normalizeData(JSON.parse(old));
      if (migrated) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }
  } catch (e) {
    console.warn("Tab Memo: load error", e);
  }
  return { version: "1.4.1", cats: ["メモ"], active: 0, memos: [[]], trash: [], lastBackupAt: null, dark: false };
}

// ─────────────────────────────────────────────
//  セーブ
// ─────────────────────────────────────────────
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  LocalFileStore.queueSave(data);
}

// ─────────────────────────────────────────────
//  DOM refs
// ─────────────────────────────────────────────
const tabsEl        = document.getElementById("tabs");
const listEl        = document.getElementById("memoList");
const floatBackdrop = document.getElementById("floatMenuBackdrop");
const plusBtn       = document.getElementById("plusBtn");
const searchBox     = document.getElementById("searchBox");
const searchInput   = document.getElementById("searchInput");
const searchCount   = document.getElementById("searchResultCount");
const tabStripWrap  = document.getElementById("tabStripWrap");
const toastEl       = document.getElementById("toast");
const storageStatusEl = document.getElementById("storageStatus");
const memoReorderBtn = document.getElementById("memoReorderBtn");
const memoSelectBtn = document.getElementById("memoSelectBtn");
const categoryReorderToggleBtn = document.getElementById("categoryReorderToggleBtn");
const categorySelectToggleBtn = document.getElementById("categorySelectToggleBtn");
const categoryDeleteSelectedBtn = document.getElementById("categoryDeleteSelectedBtn");

let storageStatusTimer = null;
let storageStatusHideTimer = null;

function setStorageStatus(message, {
  type = "info",
  persistent = false,
  duration = 2600,
  compact = false,
  details = ""
} = {}) {
  if (!storageStatusEl) return;

  clearTimeout(storageStatusTimer);
  clearTimeout(storageStatusHideTimer);
  storageStatusEl.textContent = message;
  storageStatusEl.classList.remove(
    "storage-status-hidden",
    "storage-status-show",
    "storage-status-info",
    "storage-status-saving",
    "storage-status-success",
    "storage-status-warning",
    "storage-status-error",
    "storage-status-compact",
    "storage-status-expanded"
  );
  storageStatusEl.classList.add(`storage-status-${type}`);
  storageStatusEl.classList.toggle("storage-status-compact", compact);
  storageStatusEl.dataset.summary = message;
  storageStatusEl.dataset.details = details;
  storageStatusEl.title = compact && details ? "クリックして詳細を表示" : "";

  requestAnimationFrame(() => storageStatusEl.classList.add("storage-status-show"));

  if (!persistent) {
    storageStatusTimer = setTimeout(() => {
      storageStatusEl.classList.remove("storage-status-show");
      storageStatusHideTimer = setTimeout(() => {
        storageStatusEl.classList.add("storage-status-hidden");
      }, 220);
    }, duration);
  }
}

storageStatusEl.addEventListener("click", () => {
  if (!storageStatusEl.classList.contains("storage-status-compact")) return;
  const details = storageStatusEl.dataset.details;
  if (!details) return;

  const expanded = storageStatusEl.classList.toggle("storage-status-expanded");
  storageStatusEl.textContent = expanded
    ? details
    : storageStatusEl.dataset.summary;
  storageStatusEl.title = expanded
    ? "クリックして閉じる"
    : "クリックして詳細を表示";
});

// ─────────────────────────────────────────────
//  テーマ
// ─────────────────────────────────────────────
function applyTheme() {
  document.body.classList.toggle("dark", !!data.dark);
  document.documentElement.classList.toggle("dark", !!data.dark);
  document.getElementById("themeBtn").textContent    = data.dark ? "☀️" : "🌙";
  document.getElementById("themeColorMeta").content = data.dark ? "#101827" : "#11bbbb";
}

// ─────────────────────────────────────────────
//  本文の最初の1行を自動タイトル化（全角28文字まで）
// ─────────────────────────────────────────────
function getAutoTitle(text) {
  if (!text) return "";
  const lines = text.split(/\r?\n/);
  return lines[0].trim().substring(0, 28);
}

// ─────────────────────────────────────────────
//  表示用タイトル取得（手動タイトルまたは本文第1行）
// ─────────────────────────────────────────────
function getDisplayTitle(m) {
  if (m.title) return m.title;
  return getAutoTitle(m.text);
}

// ─────────────────────────────────────────────
//  タブ描画
// ─────────────────────────────────────────────
function renderTabs() {
  tabsEl.innerHTML = "";
  data.cats.forEach((c, i) => {
    const t = document.createElement("button");
    t.className = "tab"
      + (i === data.active          ? " active" : "")
      + (i === 0                    ? " first"  : "")
      + (i === data.cats.length - 1 ? " last"   : "");
    t.textContent = c;
    t.onclick = () => {
      data.active = i;
      resetMemoModes(true);
      render({ persist: false });
      scrollActiveTabIntoView();
    };
    tabsEl.appendChild(t);
  });
}

// ─────────────────────────────────────────────
//  検索モード
// ─────────────────────────────────────────────
function enterSearchMode() {
  resetMemoModes(true);
  isSearchMode = true;
  document.body.classList.add("search-mode");
  tabStripWrap.classList.add("hidden");
  renderSearch();
}

function exitSearchMode() {
  isSearchMode = false;
  document.body.classList.remove("search-mode");
  listEl.classList.remove("search-empty");
  document.body.classList.remove("empty-list");
  searchInput.value       = "";
  searchCount.textContent = "";
  tabStripWrap.classList.remove("hidden");
  render();
}

function renderSearch() {
  const keyword = searchInput.value.trim().toLowerCase();
  listEl.innerHTML = "";

  if (!keyword) {
    searchCount.textContent = "";
    listEl.classList.add("search-empty");
    return;
  }

  listEl.classList.remove("search-empty");

  const results = [];
  data.cats.forEach((catName, catIdx) => {
    data.memos[catIdx].forEach((m, memoIdx) => {
      if (`${m.title || ""}\n${m.text || ""}`.toLowerCase().includes(keyword)) {
        results.push({ ...m, catIdx, memoIdx, catName });
      }
    });
  });

  searchCount.textContent = `${results.length} 件見つかりました`;
  if (results.length === 0) return;

  results.forEach(m => {
    const card = makeMemoCard({
      title:   getDisplayTitle(m),
      text:    m.text,
      timeStr: formatTime(m),
      badge:   m.catName,
      pinned:  m.pinned,
      onTap:   () => {
        data.active = m.catIdx;
        searchBox.classList.add("hidden");
        exitSearchMode();
        openEditor(m.memoIdx, m.catIdx, false);
      },
      onPin: () => {
        m.pinned = !m.pinned;
        save();
        renderSearch();
      },
      onCopy: () => copyTextToClipboard(toCopyText(getDisplayTitle(m), m.text)),
      onDel: () => delFromSearch(m.catIdx, m.memoIdx)
    });
    listEl.appendChild(card);
  });
}

function delFromSearch(catIdx, memoIdx) {
  confirmDelete((ok) => {
    if (!ok) return;
    trashMemoAt(catIdx, memoIdx);
    save();
    renderSearch();
    updateTrashCount();
  }, { message: "このメモをゴミ箱に移動しますか？", confirmLabel: "移動する" });
}

async function copyTextToClipboard(text) {
  const value = String(text || "");
  if (!value) return false;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch (_) {}

  try {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    ta.style.pointerEvents = "none";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch (_) {
    return false;
  }
}

function toCopyText(title, text) {
  return String(text || "").trim();
}

function showToast(message, isError = false) {
  if (!toastEl) return;
  clearTimeout(toastShowTimer);
  clearTimeout(toastHideTimer);

  toastEl.textContent = message;
  toastEl.classList.remove("hidden", "show", "ok", "error");
  toastEl.classList.add(isError ? "error" : "ok");

  toastShowTimer = setTimeout(() => {
    toastEl.classList.add("show");
  }, 10);

  toastHideTimer = setTimeout(() => {
    toastEl.classList.remove("show");
    setTimeout(() => {
      toastEl.classList.add("hidden");
    }, 140);
  }, 1200);
}

// ─────────────────────────────────────────────
//  ゴミ箱
// ─────────────────────────────────────────────
function makeTrashId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `trash-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function trashMemoAt(catIdx, memoIdx) {
  const category = data.memos[catIdx];
  if (!category || memoIdx < 0 || memoIdx >= category.length) return false;
  const [memo] = category.splice(memoIdx, 1);
  data.trash.unshift({
    id: makeTrashId(),
    type: "memo",
    deletedAt: new Date().toISOString(),
    categoryName: data.cats[catIdx] || "メモ",
    categoryIndex: catIdx,
    memo
  });
  return true;
}

function makeCategoryTrashItem(catIdx) {
  return {
    id: makeTrashId(),
    type: "category",
    deletedAt: new Date().toISOString(),
    categoryIndex: catIdx,
    category: {
      name: data.cats[catIdx] || "メモ",
      memos: data.memos[catIdx] || []
    }
  };
}

function uniqueRestoredCategoryName(name) {
  const base = String(name || "メモ");
  if (!data.cats.includes(base)) return base;
  let suffix = 1;
  let candidate = `${base} (復元)`;
  while (data.cats.includes(candidate)) {
    suffix += 1;
    candidate = `${base} (復元${suffix})`;
  }
  return candidate;
}

function formatDeletedAt(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "削除日時不明" : `${date.toLocaleString()} に削除`;
}

function updateTrashCount() {
  const count = data.trash.length;
  const countEl = document.getElementById("trashCount");
  const summaryEl = document.getElementById("trashSummary");
  if (countEl) countEl.textContent = String(count);
  if (summaryEl) summaryEl.textContent = count ? `${count}件` : "空です";
}

function restoreTrashItem(id) {
  const index = data.trash.findIndex(item => item.id === id);
  if (index < 0) return;
  const [item] = data.trash.splice(index, 1);

  if (item.type === "memo" && item.memo) {
    let targetIndex = data.cats.indexOf(item.categoryName);
    if (targetIndex < 0) {
      data.cats.push(uniqueRestoredCategoryName(item.categoryName));
      data.memos.push([]);
      targetIndex = data.cats.length - 1;
    }
    data.memos[targetIndex].push(item.memo);
    data.active = targetIndex;
  } else if (item.type === "category" && item.category) {
    data.cats.push(uniqueRestoredCategoryName(item.category.name));
    data.memos.push(Array.isArray(item.category.memos) ? item.category.memos : []);
    data.active = data.cats.length - 1;
  }

  resetMemoModes(true);
  render();
  renderTrash();
  showToast("元のデータを復元しました");
}

function permanentlyDeleteTrashItem(id) {
  confirmDelete((ok) => {
    if (!ok) return;
    data.trash = data.trash.filter(item => item.id !== id);
    save();
    renderTrash();
    updateTrashCount();
  }, {
    message: "このデータを完全に削除しますか？元に戻せません。",
    confirmLabel: "完全に削除"
  });
}

function renderTrash() {
  const list = document.getElementById("trashList");
  const emptyBtn = document.getElementById("emptyTrashBtn");
  if (!list || !emptyBtn) return;
  list.innerHTML = "";
  updateTrashCount();
  emptyBtn.disabled = data.trash.length === 0;

  if (data.trash.length === 0) {
    const empty = document.createElement("div");
    empty.className = "trash-empty-state";
    empty.textContent = "ゴミ箱は空です";
    list.appendChild(empty);
    return;
  }

  data.trash.forEach(item => {
    const row = document.createElement("article");
    row.className = "trash-row";

    const content = document.createElement("div");
    content.className = "trash-content";
    const title = document.createElement("strong");
    const isCategory = item.type === "category";
    const memoTitle = item.memo ? getDisplayTitle(item.memo) : "";
    title.textContent = isCategory
      ? `📁 ${item.category?.name || "カテゴリ"}`
      : `📝 ${memoTitle || "無題のメモ"}`;
    const meta = document.createElement("span");
    const categoryLabel = !isCategory && item.categoryName ? `・${item.categoryName}` : "";
    const memoCount = isCategory && Array.isArray(item.category?.memos)
      ? `・メモ${item.category.memos.length}件`
      : "";
    meta.textContent = `${isCategory ? "カテゴリ" : "メモ"}${categoryLabel}${memoCount}・${formatDeletedAt(item.deletedAt)}`;
    content.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "trash-actions";
    const restoreBtn = document.createElement("button");
    restoreBtn.type = "button";
    restoreBtn.className = "trash-restore-btn";
    restoreBtn.textContent = "復元";
    restoreBtn.onclick = () => restoreTrashItem(item.id);
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "trash-delete-btn";
    deleteBtn.textContent = "完全削除";
    deleteBtn.onclick = () => permanentlyDeleteTrashItem(item.id);
    actions.append(restoreBtn, deleteBtn);
    row.append(content, actions);
    list.appendChild(row);
  });
}

function openTrash() {
  closeModal();
  renderTrash();
  document.getElementById("trashModal").classList.remove("hidden");
}

function closeTrash() {
  document.getElementById("trashModal").classList.add("hidden");
}

function emptyTrash() {
  if (data.trash.length === 0) return;
  confirmDelete((ok) => {
    if (!ok) return;
    data.trash = [];
    save();
    renderTrash();
  }, {
    message: "ゴミ箱を空にしますか？すべて完全に削除されます。",
    confirmLabel: "空にする"
  });
}

function syncMemoModeButtons() {
  memoReorderBtn.classList.toggle("active", memoReorderMode);
  memoSelectBtn.classList.toggle("active", memoSelectMode);
  memoReorderBtn.title = memoReorderMode ? "メモの並び替えを終了" : "メモを並び替え";
  memoSelectBtn.title = memoSelectMode ? "メモの複数選択を終了" : "メモを複数選択";
}

function resetMemoModes(skipRender = false) {
  memoSelectMode = false;
  memoReorderMode = false;
  selectedMemoIndexes.clear();
  memoSwapFromIdx = null;
  syncMemoModeButtons();
  if (!skipRender && !isSearchMode) renderMemos();
}

function toggleMemoSelectMode() {
  if (isSearchMode) return;
  memoSelectMode = !memoSelectMode;
  memoReorderMode = false;
  selectedMemoIndexes.clear();
  memoSwapFromIdx = null;
  syncMemoModeButtons();
  closeFloat();
  renderMemos();
}

function toggleMemoReorderMode() {
  if (isSearchMode) return;
  memoReorderMode = !memoReorderMode;
  memoSelectMode = false;
  selectedMemoIndexes.clear();
  memoSwapFromIdx = null;
  syncMemoModeButtons();
  closeFloat();
  renderMemos();
}

function toggleMemoSelection(idx) {
  if (selectedMemoIndexes.has(idx)) selectedMemoIndexes.delete(idx);
  else selectedMemoIndexes.add(idx);
  renderMemos();
}

function pinSelectedMemos() {
  if (!memoSelectMode || selectedMemoIndexes.size === 0) return;
  const memos = data.memos[data.active];
  const selected = [...selectedMemoIndexes];
  const allPinned = selected.every((idx) => memos[idx] && memos[idx].pinned);
  selected.forEach((idx) => {
    if (memos[idx]) memos[idx].pinned = !allPinned;
  });
  render({ persist: false });
}

function deleteSelectedMemos() {
  if (!memoSelectMode || selectedMemoIndexes.size === 0) return;
  confirmDelete((ok) => {
    if (!ok) return;
    const memos = data.memos[data.active];
    [...selectedMemoIndexes].sort((a, b) => b - a).forEach((idx) => {
      if (idx >= 0 && idx < memos.length) trashMemoAt(data.active, idx);
    });
    selectedMemoIndexes.clear();
    if (memos.length === 0) memoSelectMode = false;
    render();
  }, { message: "選択したメモをゴミ箱に移動しますか？", confirmLabel: "移動する" });
}

function swapMemo(aIdx, bIdx) {
  const memos = data.memos[data.active];
  if (!memos || aIdx === bIdx) return;
  if (aIdx < 0 || bIdx < 0 || aIdx >= memos.length || bIdx >= memos.length) return;
  [memos[aIdx], memos[bIdx]] = [memos[bIdx], memos[aIdx]];
}

function onMemoReorderTap(idx) {
  const memos = data.memos[data.active];
  if (memoSwapFromIdx === null) {
    memoSwapFromIdx = idx;
    renderMemos();
    return;
  }
  if (memoSwapFromIdx === idx) {
    memoSwapFromIdx = null;
    renderMemos();
    return;
  }

  const fromMemo = memos[memoSwapFromIdx];
  const toMemo = memos[idx];
  if (!fromMemo || !toMemo) {
    memoSwapFromIdx = null;
    renderMemos();
    return;
  }
  if (!!fromMemo.pinned !== !!toMemo.pinned) {
    showToast("ピン状態が違うメモ同士は入れ替えできません", true);
    return;
  }

  swapMemo(memoSwapFromIdx, idx);
  memoSwapFromIdx = null;
  render();
}

function makeMemoModeToolbar(memos) {
  const bar = document.createElement("div");
  bar.className = "memo-mode-toolbar";

  const info = document.createElement("div");
  info.className = "memo-mode-info";

  if (memoSelectMode) {
    info.textContent = `✅ ${selectedMemoIndexes.size}件選択中`;
    bar.appendChild(info);

    const pinBtn = document.createElement("button");
    const selected = [...selectedMemoIndexes];
    const allPinned = selected.length > 0 && selected.every((idx) => memos[idx] && memos[idx].pinned);
    pinBtn.textContent = allPinned ? "📍 ピン解除" : "📌 ピン留め";
    pinBtn.disabled = selected.length === 0;
    pinBtn.onclick = pinSelectedMemos;
    bar.appendChild(pinBtn);

    const delBtn = document.createElement("button");
    delBtn.className = "danger";
    delBtn.textContent = "🗑 削除";
    delBtn.disabled = selected.length === 0;
    delBtn.onclick = deleteSelectedMemos;
    bar.appendChild(delBtn);
  } else {
    if (memoSwapFromIdx === null) {
      info.textContent = "🔀 入れ替え元メモをタップ";
    } else {
      const title = getDisplayTitle(memos[memoSwapFromIdx]) || "(無題)";
      info.textContent = `🔀 入れ替え先をタップ: ${title}`;
    }
    bar.appendChild(info);

    const clearBtn = document.createElement("button");
    clearBtn.textContent = "選択解除";
    clearBtn.disabled = memoSwapFromIdx === null;
    clearBtn.onclick = () => { memoSwapFromIdx = null; renderMemos(); };
    bar.appendChild(clearBtn);
  }

  const doneBtn = document.createElement("button");
  doneBtn.textContent = "完了";
  doneBtn.onclick = () => resetMemoModes();
  bar.appendChild(doneBtn);

  return bar;
}

// ─────────────────────────────────────────────
//  メモカード生成（通常・検索共通）
// ─────────────────────────────────────────────
function makeMemoCard({
  title, text, timeStr, badge = null, pinned = false,
  onTap, onPin, onCopy, onDel,
  selectMode = false, selected = false, onSelect = null,
  reorderMode = false, moving = false, onReorderTap = null
}) {
  const article = document.createElement("article");
  article.className = "memo memo-tappable"
    + (pinned ? " memo-pinned" : "")
    + (selectMode ? " memo-select-mode" : "")
    + (selected ? " memo-selected" : "")
    + (moving ? " memo-moving" : "");

  if (badge) {
    const b = document.createElement("div");
    b.className   = "memo-cat-badge";
    b.textContent = badge;
    article.appendChild(b);
  }

  const titleEl = document.createElement("div");
  titleEl.className     = "memo-title";
  titleEl.textContent   = title || "";
  titleEl.style.display = title ? "block" : "none";
  article.appendChild(titleEl);

  const textEl = document.createElement("div");
  textEl.className   = "memo-text";
  textEl.textContent = text || "";
  article.appendChild(textEl);

  const actions = document.createElement("div");
  actions.className = "actions";

  if (selectMode) {
    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "memo-select-check";
    check.checked = !!selected;
    check.onclick = (e) => {
      e.stopPropagation();
      if (onSelect) onSelect();
    };
    article.appendChild(check);
  } else if (!reorderMode) {
    const pinBtn = document.createElement("button");
    pinBtn.className   = "pin-btn";
    pinBtn.title       = pinned ? "ピンを外す" : "ピン留め";
    pinBtn.textContent = pinned ? "📌" : "📍";
    pinBtn.onclick = (e) => { e.stopPropagation(); if (onPin) onPin(); };
    actions.appendChild(pinBtn);

    if (onCopy) {
      const copyBtn = document.createElement("button");
      copyBtn.title = "コピー";
      copyBtn.textContent = "📋";
      copyBtn.onclick = async (e) => {
        e.stopPropagation();
        const ok = await onCopy();
        const prev = copyBtn.textContent;
        copyBtn.textContent = ok ? "✅" : "⚠️";
        showToast(ok ? "メモをコピーしました" : "コピーに失敗しました", !ok);
        copyBtn.disabled = true;
        setTimeout(() => {
          copyBtn.textContent = prev;
          copyBtn.disabled = false;
        }, 900);
      };
      actions.appendChild(copyBtn);
    }

    const delBtn = document.createElement("button");
    delBtn.title       = "削除";
    delBtn.textContent = "🗑";
    delBtn.onclick = (e) => { e.stopPropagation(); onDel(); };
    actions.appendChild(delBtn);
    article.appendChild(actions);
  }

  const timeEl = document.createElement("div");
  timeEl.className   = "time";
  timeEl.textContent = timeStr;
  article.appendChild(timeEl);

  article.onclick = (e) => {
    if (selectMode) {
      if (onSelect) onSelect();
      return;
    }
    if (reorderMode) {
      if (onReorderTap) onReorderTap();
      return;
    }
    if (!e.target.closest(".actions")) onTap();
  };

  return article;
}

function makeInlineAddMemoButton() {
  const wrap = document.createElement("div");
  wrap.className = "memo-add-row";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "memo-add-btn";
  btn.textContent = "＋ メモを追加";
  btn.onclick = () => add();

  wrap.appendChild(btn);
  return wrap;
}

// ─────────────────────────────────────────────
//  通常メモ描画
// ─────────────────────────────────────────────
function formatTime(m) {
  let result = `作成: ${m.created}`;
  if (m.updated) {
    result += ` | 更新: ${m.updated}`;
  }
  return result;
}

function renderMemos() {
  listEl.innerHTML = "";
  const addMemoBtnRow = makeInlineAddMemoButton();
  const memos = data.memos[data.active];

  if (!memoSelectMode) selectedMemoIndexes.clear();
  if (!memoReorderMode) memoSwapFromIdx = null;

  if (memos) {
    selectedMemoIndexes.forEach((idx) => {
      if (idx < 0 || idx >= memos.length) selectedMemoIndexes.delete(idx);
    });
    if (memoSwapFromIdx !== null && (memoSwapFromIdx < 0 || memoSwapFromIdx >= memos.length)) {
      memoSwapFromIdx = null;
    }
  }

  if (!memos || memos.length === 0) {
    if (memoSelectMode || memoReorderMode) resetMemoModes(true);
    document.body.classList.add("empty-list");
    listEl.appendChild(addMemoBtnRow);
    return;
  }
  document.body.classList.remove("empty-list");

  if (memoSelectMode || memoReorderMode) {
    listEl.appendChild(makeMemoModeToolbar(memos));
  }

  // ピン留めメモと通常メモを分ける
  const pinnedMemos = memos.filter(m => m.pinned);
  const normalMemos = memos.filter(m => !m.pinned);
  
  // 時系列逆順（新しい順）でソート
  const sortedPinned = [...pinnedMemos].reverse();
  const sortedNormal = [...normalMemos].reverse();
  const sortedAll = [...sortedPinned, ...sortedNormal];
  
  // 元のインデックスマップを作成（逆順ソート後のインデックスを元に戻す）
  const indexMap = new Map();
  memos.forEach((m, i) => {
    if (m.pinned) sortedPinned.forEach((pm, pi) => { if (pm === m) indexMap.set(sortedPinned[pi], i); });
    else sortedNormal.forEach((nm, ni) => { if (nm === m) indexMap.set(sortedNormal[ni], i); });
  });

  sortedAll.forEach((m) => {
    const originalIdx = memos.indexOf(m);
    const card = makeMemoCard({
      title:   getDisplayTitle(m),
      text:    m.text,
      timeStr: formatTime(m),
      pinned:  m.pinned,
      onTap:   () => openEditor(originalIdx, data.active, false),
      onPin:   () => { m.pinned = !m.pinned; render(); },
      onCopy:  () => copyTextToClipboard(toCopyText(getDisplayTitle(m), m.text)),
      onDel:   () => del(originalIdx),
      selectMode: memoSelectMode,
      selected: selectedMemoIndexes.has(originalIdx),
      onSelect: () => toggleMemoSelection(originalIdx),
      reorderMode: memoReorderMode,
      moving: memoReorderMode && memoSwapFromIdx === originalIdx,
      onReorderTap: () => onMemoReorderTap(originalIdx)
    });
    listEl.appendChild(card);
  });

  listEl.appendChild(addMemoBtnRow);
}

// ─────────────────────────────────────────────
//  カテゴリモーダル描画
// ─────────────────────────────────────────────
function resetCategoryModalState() {
  catReorderMode = false;
  catSelectMode = false;
  selectedCatIndexes.clear();
  catMoveFromIdx = null;
}

function syncCategoryToolbar() {
  categoryReorderToggleBtn.classList.toggle("active", catReorderMode);
  categoryReorderToggleBtn.textContent = catReorderMode ? "🔀 並び替え終了" : "🔀 並び替え";

  categorySelectToggleBtn.classList.toggle("active", catSelectMode);
  categorySelectToggleBtn.textContent = catSelectMode ? `✅ 選択中 (${selectedCatIndexes.size})` : "✅ 複数選択";

  categoryDeleteSelectedBtn.classList.toggle("hidden", !catSelectMode);
  categoryDeleteSelectedBtn.disabled = !catSelectMode || selectedCatIndexes.size === 0;
}

function swapCat(aIdx, bIdx) {
  if (aIdx === bIdx) return;
  if (aIdx < 0 || bIdx < 0 || aIdx >= data.cats.length || bIdx >= data.cats.length) return;
  [data.cats[aIdx], data.cats[bIdx]] = [data.cats[bIdx], data.cats[aIdx]];
  [data.memos[aIdx], data.memos[bIdx]] = [data.memos[bIdx], data.memos[aIdx]];
  if (data.active === aIdx) data.active = bIdx;
  else if (data.active === bIdx) data.active = aIdx;
  render();
  renderCategoryModal();
}

function toggleCategorySelection(i) {
  if (selectedCatIndexes.has(i)) selectedCatIndexes.delete(i);
  else selectedCatIndexes.add(i);
  renderCategoryModal();
}

function renderCategoryModal() {
  const box = document.getElementById("categoryList");
  box.innerHTML = "";
  syncCategoryToolbar();

  if (catReorderMode) {
    const guide = document.createElement("div");
    guide.className = "category-reorder-guide";
    guide.textContent = catMoveFromIdx === null
      ? "🔀 入れ替え元カテゴリをタップ"
      : `🔀 入れ替え先をタップ: ${data.cats[catMoveFromIdx]}`;
    box.appendChild(guide);
  }

  data.cats.forEach((c, i) => {
    const row = document.createElement("div");
    row.className = "category-row";
    if (catSelectMode && selectedCatIndexes.has(i)) row.classList.add("selected");
    if (catReorderMode && catMoveFromIdx === i) row.classList.add("moving");

    row.onclick = () => {
      if (catSelectMode) {
        toggleCategorySelection(i);
        return;
      }
      if (catReorderMode) {
        if (catMoveFromIdx === null) {
          catMoveFromIdx = i;
          renderCategoryModal();
          return;
        }
        if (catMoveFromIdx === i) {
          catMoveFromIdx = null;
          renderCategoryModal();
          return;
        }
        const fromIdx = catMoveFromIdx;
        catMoveFromIdx = null;
        swapCat(fromIdx, i);
        return;
      }
      data.active = i;
      resetMemoModes(true);
      closeModal();
      render({ persist: false });
      scrollActiveTabIntoView();
    };

    if (catSelectMode) {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "category-select";
      checkbox.checked = selectedCatIndexes.has(i);
      checkbox.onclick = (e) => {
        e.stopPropagation();
        toggleCategorySelection(i);
      };
      row.appendChild(checkbox);
    }

    const nameEl = document.createElement("div");
    nameEl.className   = "category-name";
    nameEl.textContent = c;
    row.appendChild(nameEl);

    const actions = document.createElement("div");
    actions.className = "category-actions";

    if (catReorderMode) {
      const orderBadge = document.createElement("span");
      orderBadge.className = "category-order-badge";
      orderBadge.textContent = String(i + 1);
      actions.appendChild(orderBadge);
    } else {
      const renameBtn = document.createElement("button");
      renameBtn.className   = "rename-btn";
      renameBtn.title       = "名前変更";
      renameBtn.textContent = "📝";
      renameBtn.onclick = (e) => { e.stopPropagation(); renameCat(i); };

      const delBtn = document.createElement("button");
      delBtn.title       = "削除";
      delBtn.textContent = "🗑";
      delBtn.onclick = (e) => { e.stopPropagation(); deleteCat(i); };

      actions.appendChild(renameBtn);
      actions.appendChild(delBtn);
    }

    row.appendChild(actions);
    box.appendChild(row);
  });
}

// ─────────────────────────────────────────────
//  メインrender
// ─────────────────────────────────────────────
function render({ persist = true } = {}) {
  applyTheme();
  syncMemoModeButtons();
  updateTrashCount();
  updateBackupStatus();
  renderTabs();
  renderMemos();
  if (persist) save();
}

// ─────────────────────────────────────────────
//  エディタ
//  backToModal=true の場合、閉じたらカテゴリモーダルへ戻る
// ─────────────────────────────────────────────
function openEditor(index = null, catIdx = null, backToModal = false) {
  editingIndex  = index;
  editingCatIdx = catIdx !== null ? catIdx : data.active;
  returnToModal = backToModal;

  const isEdit = index !== null;
  document.getElementById("editorTitle").textContent = isEdit ? "メモを編集" : "メモを作成";

  const memo = isEdit ? data.memos[editingCatIdx][index] : { title: "", text: "" };
  document.getElementById("memoTitleInput").value = memo.title || "";
  document.getElementById("memoBodyInput").value  = memo.text  || "";
  editorInitialValue = {
    title: document.getElementById("memoTitleInput").value,
    text: document.getElementById("memoBodyInput").value
  };
  document.getElementById("memoEditorModal").classList.remove("hidden");
  setTimeout(() => document.getElementById("memoTitleInput").focus(), 50);
}

function isMemoEditorOpen() {
  return !document.getElementById("memoEditorModal").classList.contains("hidden");
}

function hasUnsavedEditorChanges() {
  if (!isMemoEditorOpen()) return false;
  return document.getElementById("memoTitleInput").value !== editorInitialValue.title
    || document.getElementById("memoBodyInput").value !== editorInitialValue.text;
}

function closeEditor(force = false) {
  if (!force && hasUnsavedEditorChanges()) {
    confirmDelete((ok) => {
      if (ok) closeEditor(true);
    }, {
      message: "未保存の変更があります。どうしますか？",
      confirmLabel: "保存せず閉じる",
      onSave: saveEditor
    });
    return;
  }

  document.getElementById("memoEditorModal").classList.add("hidden");
  editingIndex  = null;
  editingCatIdx = null;
  editorInitialValue = { title: "", text: "" };

  if (returnToModal) {
    returnToModal = false;
    renderCategoryModal();
    document.getElementById("categoryModal").classList.remove("hidden");
  }
}

function saveEditor() {
  const title = document.getElementById("memoTitleInput").value.trim();
  const text  = document.getElementById("memoBodyInput").value.trim();
  if (!title && !text) {
    alert("タイトルか本文を入力してください。");
    return;
  }

  const now = new Date().toLocaleString();

  if (editingIndex === null) {
    data.memos[data.active].push({ title, text, created: now, updated: null, pinned: false });
  } else {
    const existing = data.memos[editingCatIdx][editingIndex];

    if (existing && existing.title === title && existing.text === text) {
      data.active = editingCatIdx;
      closeEditor(true);
      render({ persist: false });
      return;
    }

    data.memos[editingCatIdx][editingIndex] = {
      title,
      text,
      created: existing ? existing.created : now,
      updated: now,
      pinned: !!(existing && existing.pinned)
    };
    data.active = editingCatIdx;
  }

  closeEditor(true);
  render();
}

// ─────────────────────────────────────────────
//  CRUD
// ─────────────────────────────────────────────
function add() { openEditor(null, null, false); }

function del(i) {
  confirmDelete((ok) => {
    if (!ok) return;
    trashMemoAt(data.active, i);
    render();
  }, { message: "このメモをゴミ箱に移動しますか？", confirmLabel: "移動する" });
}

// ─────────────────────────────────────────────
//  カテゴリ操作
// ─────────────────────────────────────────────
// カテゴリ編集モーダル
let catEditCallback = null; // 保存時に呼ぶコールバック

function openCatNameModal(title, defaultVal, onSave) {
  catEditCallback = onSave;
  document.getElementById("catNameTitle").textContent = title;
  document.getElementById("catNameInput").value = defaultVal || "";
  document.getElementById("catNameModal").classList.remove("hidden");
  setTimeout(() => document.getElementById("catNameInput").focus(), 50);
}

function closeCatNameModal() {
  document.getElementById("catNameModal").classList.add("hidden");
  catEditCallback = null;
}

function saveCatName() {
  const name = document.getElementById("catNameInput").value.trim();
  if (!name) { document.getElementById("catNameInput").focus(); return; }
  const onSave = catEditCallback;
  closeCatNameModal();
  if (onSave) onSave(name);
}

function deleteSelectedCats() {
  if (!catSelectMode || selectedCatIndexes.size === 0) return;
  if (data.cats.length - selectedCatIndexes.size < 1) {
    alert("カテゴリは最低1つ必要です。");
    return;
  }

  confirmDelete((ok) => {
    if (!ok) return;
    [...selectedCatIndexes]
      .sort((a, b) => b - a)
      .forEach(i => data.trash.unshift(makeCategoryTrashItem(i)));
    const keepIndexes = data.cats
      .map((_, i) => i)
      .filter((i) => !selectedCatIndexes.has(i));

    const deletedActive = selectedCatIndexes.has(data.active);
    data.cats = keepIndexes.map((i) => data.cats[i]);
    data.memos = keepIndexes.map((i) => data.memos[i]);

    if (deletedActive) {
      const nextActive = keepIndexes.findIndex((i) => i > data.active);
      data.active = nextActive >= 0 ? nextActive : data.cats.length - 1;
    } else {
      data.active = keepIndexes.indexOf(data.active);
    }

    catSelectMode = false;
    selectedCatIndexes.clear();
    resetMemoModes(true);
    render();
    renderCategoryModal();
    scrollActiveTabIntoView();
  }, { message: "選択したカテゴリをメモごとゴミ箱に移動しますか？", confirmLabel: "移動する" });
}

function addCat() {
  const categoryModalOpen = !document.getElementById("categoryModal").classList.contains("hidden");
  openCatNameModal("カテゴリを追加", "", (name) => {
    data.cats.push(name);
    data.memos.push([]);
    data.active = data.cats.length - 1;
    resetMemoModes(true);
    render();
    if (categoryModalOpen) renderCategoryModal();
    scrollActiveTabIntoView();
  });
}

function renameCat(i) {
  openCatNameModal("カテゴリ名を変更", data.cats[i], (name) => {
    data.cats[i] = name;
    renderCategoryModal();
    renderTabs();
    save();
  });
}

function deleteCat(i) {
  if (data.cats.length <= 1) { alert("カテゴリは最低1つ必要です。"); return; }
  confirmDelete((ok) => {
    if (!ok) return;
    data.trash.unshift(makeCategoryTrashItem(i));
    data.cats.splice(i, 1);
    data.memos.splice(i, 1);
    if (data.active >= data.cats.length) data.active = data.cats.length - 1;
    selectedCatIndexes.clear();
    resetMemoModes(true);
    closeModal();
    render();
    scrollActiveTabIntoView();
  }, { message: "このカテゴリを中のメモごとゴミ箱に移動しますか？", confirmLabel: "移動する" });
}

function scrollActiveTabIntoView() {
  const active = tabsEl.querySelector(".tab.active");
  if (active) active.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
}

// ─────────────────────────────────────────────
//  スワイプでタブ切り替え
// ─────────────────────────────────────────────
function moveCategory(dir) {
  if (isSearchMode) return;
  const next = data.active + dir;
  if (next < 0 || next >= data.cats.length) return;
  data.active = next;
  resetMemoModes(true);
  render({ persist: false });
  scrollActiveTabIntoView();
}

function setupSwipe() {
  const ignore = [
    "button","input","textarea","select","a",
    ".tabs",".tab-strip-wrap",".modal",".editor-modal",".float-menu-backdrop"
  ].join(",");

  document.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    swipeIgnore = !!e.target.closest(ignore);
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true, capture: true });

  document.addEventListener("touchend", (e) => {
    if (swipeIgnore || e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.35) moveCategory(dx < 0 ? 1 : -1);
  }, { passive: true, capture: true });
}

// ─────────────────────────────────────────────
//  リサイズ時タブ再描画
// ─────────────────────────────────────────────
function setupResizeHandler() {
  let timer = null;
  const handler = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { renderTabs(); scrollActiveTabIntoView(); }, 180);
  };
  window.addEventListener("resize", handler);
  window.addEventListener("orientationchange", handler);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", handler);
}

// ─────────────────────────────────────────────
//  カテゴリモーダル開閉
// ─────────────────────────────────────────────
function openModal() {
  resetCategoryModalState();
  renderCategoryModal();
  document.getElementById("categoryModal").classList.remove("hidden");
  setTimeout(() => document.getElementById("closeModalBtn").focus(), 0);
}

function closeModal() {
  document.getElementById("categoryModal").classList.add("hidden");
  resetCategoryModalState();
}

// ─────────────────────────────────────────────
//  フローティングメニュー
// ─────────────────────────────────────────────
function isFloatOpen() { return !floatBackdrop.classList.contains("hidden"); }
function openFloat()   { floatBackdrop.classList.remove("hidden"); plusBtn.textContent = "×"; plusBtn.classList.add("open"); }
function closeFloat()  { floatBackdrop.classList.add("hidden");    plusBtn.textContent = "＋"; plusBtn.classList.remove("open"); }
function toggleFloat() { isFloatOpen() ? closeFloat() : openFloat(); }

// ─────────────────────────────────────────────
//  イベント登録
// ─────────────────────────────────────────────

/**
 * モーダル内部から始まったドラッグ操作を、背景クリックとして扱わない。
 * テキスト選択中に枠外でポインターを離してもモーダルを維持する。
 */
function setupSafeBackdropClose(overlay, contentSelector, onClose) {
  let pointerStartedInside = false;

  overlay.addEventListener("pointerdown", (e) => {
    pointerStartedInside = !!e.target.closest(contentSelector);
  }, true);

  overlay.addEventListener("click", (e) => {
    if (e.target !== overlay) {
      pointerStartedInside = false;
      return;
    }
    if (pointerStartedInside) {
      pointerStartedInside = false;
      return;
    }
    onClose();
  });
}

function setupModalFocusTrap(overlay) {
  overlay.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || overlay.classList.contains("hidden")) return;
    const focusable = [...overlay.querySelectorAll(
      'button:not([disabled]):not(.hidden), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )].filter(el => !el.closest(".hidden"));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
}

// FAB・フローティングメニュー
plusBtn.onclick = toggleFloat;
document.getElementById("floatMemoBtn").onclick     = () => { closeFloat(); add(); };
document.getElementById("floatCategoryBtn").onclick = () => { closeFloat(); addCat(); };
setupSafeBackdropClose(floatBackdrop, ".float-menu", closeFloat);

// エディタ
document.getElementById("cancelMemoBtn").onclick  = () => closeEditor();
document.getElementById("saveMemoBtn").onclick    = saveEditor;
setupModalFocusTrap(document.getElementById("memoEditorModal"));

// カテゴリ名入力モーダル
document.getElementById("cancelCatBtn").onclick = closeCatNameModal;
document.getElementById("saveCatBtn").onclick   = saveCatName;
document.getElementById("catNameInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveCatName();
});
setupModalFocusTrap(document.getElementById("catNameModal"));

// カテゴリモーダル
document.getElementById("menuBtn").onclick        = openModal;
document.getElementById("closeModalBtn").onclick  = closeModal;
document.getElementById("categoryAddBtn").onclick = () => addCat();
categoryReorderToggleBtn.onclick = () => {
  catReorderMode = !catReorderMode;
  if (catReorderMode) {
    catSelectMode = false;
    selectedCatIndexes.clear();
  } else {
    catMoveFromIdx = null;
  }
  renderCategoryModal();
};
categorySelectToggleBtn.onclick = () => {
  catSelectMode = !catSelectMode;
  if (catSelectMode) {
    catReorderMode = false;
    catMoveFromIdx = null;
  } else {
    selectedCatIndexes.clear();
  }
  renderCategoryModal();
};
categoryDeleteSelectedBtn.onclick = deleteSelectedCats;
setupModalFocusTrap(document.getElementById("categoryModal"));

// ゴミ箱
document.getElementById("trashBtn").onclick = openTrash;
document.getElementById("closeTrashBtn").onclick = closeTrash;
document.getElementById("closeTrashFooterBtn").onclick = closeTrash;
document.getElementById("emptyTrashBtn").onclick = emptyTrash;
setupSafeBackdropClose(
  document.getElementById("trashModal"),
  ".modal-card",
  closeTrash
);

// 検索
document.getElementById("searchBtn").onclick = () => {
  if (searchBox.classList.contains("hidden")) {
    searchBox.classList.remove("hidden");
    searchInput.focus();
    enterSearchMode();
  } else {
    searchBox.classList.add("hidden");
    exitSearchMode();
  }
};
searchInput.oninput = () => { if (isSearchMode) renderSearch(); };
document.addEventListener("pointerdown", (e) => {
  if (!isSearchMode) return;
  if (e.target.closest("#searchBox, #searchBtn")) return;
  searchBox.classList.add("hidden");
  exitSearchMode();
});
memoReorderBtn.onclick = toggleMemoReorderMode;
memoSelectBtn.onclick = toggleMemoSelectMode;

// テーマ
document.getElementById("themeBtn").onclick = () => { data.dark = !data.dark; render(); };

window.addEventListener("beforeunload", (e) => {
  if (!hasUnsavedEditorChanges()) return;
  e.preventDefault();
  e.returnValue = "";
});

// ─────────────────────────────────────────────
//  バックアップ モジュール
//  将来: Google Drive・任意フォルダ対応はここに追加する
// ─────────────────────────────────────────────

const Backup = {
  /** バックアップJSONのBlobを生成 */
  makeBlob(backupAt = data.lastBackupAt) {
    const snapshot = { ...data, lastBackupAt: backupAt };
    return new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  },

  /** ファイル名を生成 */
  makeFilename() {
    const d = new Date().toLocaleDateString("ja-JP").replace(/\//g, "-");
    return `tab-memo-backup_${d}.json`;
  },

  /** 端末にダウンロード保存 */
  saveLocal() {
    const a  = document.createElement("a");
    const backupAt = new Date().toISOString();
    a.href   = URL.createObjectURL(Backup.makeBlob(backupAt));
    a.download = Backup.makeFilename();
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    recordBackupCompleted(backupAt);
    closeBackupModal();
  },

  /**
   * Google Drive保存（将来実装）
   * 実装時はここにGoogle Drive APIの処理を書く
   */
  saveGdrive() {
    alert("Google ドライブ連携は今後実装予定です。");
  },

  /**
   * 任意フォルダ保存（将来: File System Access API）
   * 対応ブラウザ: Chrome/Edge 86+
   */
  async saveCustomPath() {
    if (!("showSaveFilePicker" in window)) {
      Backup.saveLocal(); // 非対応ブラウザはダウンロードにフォールバック
      return;
    }
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: Backup.makeFilename(),
        types: [{ description: "JSON", accept: { "application/json": [".json"] } }]
      });
      const backupAt = new Date().toISOString();
      const writable = await handle.createWritable();
      await writable.write(Backup.makeBlob(backupAt));
      await writable.close();
      recordBackupCompleted(backupAt);
      closeBackupModal();
    } catch (e) {
      if (e.name !== "AbortError") alert("保存に失敗しました。");
    }
  }
};

function formatBackupTime(value) {
  if (!value) return "まだありません";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "まだありません" : date.toLocaleString();
}

function updateBackupStatus() {
  const label = `最終バックアップ: ${formatBackupTime(data.lastBackupAt)}`;
  const statusEl = document.getElementById("lastBackupAt");
  const buttonEl = document.getElementById("backupBtn");
  if (statusEl) statusEl.textContent = label;
  if (buttonEl) buttonEl.title = label;
}

function recordBackupCompleted(backupAt = new Date().toISOString()) {
  data.lastBackupAt = backupAt;
  save();
  updateBackupStatus();
}

function openBackupModal()  {
  updateBackupStatus();
  document.getElementById("backupModal").classList.remove("hidden");
}
function closeBackupModal() { document.getElementById("backupModal").classList.add("hidden"); }

// バックアップ
document.getElementById("backupBtn").onclick          = openBackupModal;
document.getElementById("cancelBackupBtn").onclick    = closeBackupModal;
document.getElementById("backupLocalBtn").onclick     = () => { Backup.saveCustomPath(); };
document.getElementById("backupGdriveBtn").onclick    = Backup.saveGdrive;
setupSafeBackdropClose(
  document.getElementById("backupModal"),
  ".editor-card",
  closeBackupModal
);

// 復元
document.getElementById("restoreBtn").onclick    = () => document.getElementById("restoreInput").click();
document.getElementById("restoreInput").onchange = (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const imported = normalizeData(JSON.parse(r.result));
      if (!imported) throw new Error("invalid");
      data = imported;
      render();
      alert("復元しました。");
    } catch {
      alert("復元に失敗しました。ファイルを確認してください。");
    }
    e.target.value = "";
  };
  r.onerror = () => { alert("ファイルの読み込みに失敗しました。"); e.target.value = ""; };
  r.readAsText(f);
};

// ─────────────────────────────────────────────
//  Service Worker
// ─────────────────────────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

// ─────────────────────────────────────────────
//  起動
// ─────────────────────────────────────────────
async function initializeApp() {
  try {
    const localFile = await LocalFileStore.load();
    if (localFile.available && localFile.exists) {
      const loaded = normalizeData(localFile.data);
      if (!loaded) throw new Error("invalid local data file");
      data = loaded;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      LocalFileStore.remember(data);
    }
  } catch (error) {
    LocalFileStore.available = false;
    console.warn("Tab Memo: local file load error", error);
    setStorageStatus("⚠️ ローカルファイルを読み込めません。ブラウザ内のデータを使用しています。", {
      type: "error",
      persistent: true
    });
  }

  render();
  setupSwipe();
  setupResizeHandler();
  setTimeout(scrollActiveTabIntoView, 100);
}

initializeApp();

