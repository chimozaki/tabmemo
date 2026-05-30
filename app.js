// =============================================
//  Tab Memo 1.1.0
//  正式版リリース: 機能安定化とUI最適化
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

let data          = load();
let editingIndex  = null;   // 編集中メモのインデックス
let editingCatIdx = null;   // 編集中メモのカテゴリインデックス
let returnToModal = false;  // 編集後にカテゴリモーダルへ戻るか
let isSearchMode  = false;
let touchStartX   = 0;
let touchStartY   = 0;
let swipeIgnore   = false;
let selectingMemoBody = false;
let skipNextEditorBackdropClose = false;
let toastShowTimer = null;
let toastHideTimer = null;

let confirmDeleteBusy = false;

/**
 * 「削除しますか？」の軽量バーでネイティブ confirm を代替する。
 */
function confirmDelete(cb) {
  if (confirmDeleteBusy) return;
  confirmDeleteBusy = true;

  const bar    = document.getElementById("confirmBar");
  const btnCx  = document.getElementById("confirmBarCancel");
  const btnDel = document.getElementById("confirmBarDelete");
  const msg    = document.getElementById("confirmBarMessage");
  msg.textContent = "本当に削除しますか？";

  const cleanup = () => {
    bar.classList.add("hidden");
    btnCx.removeEventListener("click", onCancel);
    btnDel.removeEventListener("click", onConfirm);
    document.removeEventListener("keydown", onKeyDown);
    confirmDeleteBusy = false;
  };

  const finish = (ok) => {
    cleanup();
    cb(ok);
  };

  function onCancel() { finish(false); }
  function onConfirm() { finish(true); }

  function onKeyDown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      finish(false);
    }
  }

  btnCx.addEventListener("click", onCancel);
  btnDel.addEventListener("click", onConfirm);
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

  if (typeof d.active !== "number" || d.active < 0 || d.active >= d.cats.length) d.active = 0;
  if (typeof d.dark !== "boolean") d.dark = false;
  d.version = "1.1.0";
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
  return { version: "1.1.0", cats: ["メモ"], active: 0, memos: [[]], dark: false };
}

// ─────────────────────────────────────────────
//  セーブ
// ─────────────────────────────────────────────
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
    t.onclick = () => { data.active = i; render(); scrollActiveTabIntoView(); };
    tabsEl.appendChild(t);
  });
}

// ─────────────────────────────────────────────
//  検索モード
// ─────────────────────────────────────────────
function enterSearchMode() {
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
    data.memos[catIdx].splice(memoIdx, 1);
    save();
    renderSearch();
  });
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
  const joined = title ? `${title}\n${text || ""}` : (text || "");
  return joined.trim();
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
//  メモカード生成（通常・検索共通）
// ─────────────────────────────────────────────
function makeMemoCard({ title, text, timeStr, badge = null, pinned = false, onTap, onPin, onCopy, onDel }) {
  const article = document.createElement("article");
  article.className = "memo memo-tappable" + (pinned ? " memo-pinned" : "");

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
  
  const pinBtn = document.createElement("button");
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

  const timeEl = document.createElement("div");
  timeEl.className   = "time";
  timeEl.textContent = timeStr;
  article.appendChild(timeEl);

  article.onclick = (e) => { if (!e.target.closest(".actions")) onTap(); };

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
  if (!memos || memos.length === 0) {
    document.body.classList.add("empty-list");
    listEl.appendChild(addMemoBtnRow);
    return;
  }
  document.body.classList.remove("empty-list");

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
      onDel:   () => del(originalIdx)
    });
    listEl.appendChild(card);
  });

  listEl.appendChild(addMemoBtnRow);
}

// ─────────────────────────────────────────────
//  カテゴリモーダル描画
// ─────────────────────────────────────────────
function renderCategoryModal() {
  const box = document.getElementById("categoryList");
  box.innerHTML = "";

  data.cats.forEach((c, i) => {
    const row = document.createElement("div");
    row.className = "category-row";

    const nameEl = document.createElement("div");
    nameEl.className   = "category-name";
    nameEl.textContent = c;
    nameEl.onclick = () => {
      data.active = i;
      closeModal();
      render();
      scrollActiveTabIntoView();
    };

    const renameBtn = document.createElement("button");
    renameBtn.className   = "rename-btn";
    renameBtn.title       = "名前変更";
    renameBtn.textContent = "📝";
    renameBtn.onclick = (e) => { e.stopPropagation(); renameCat(i); };

    const delBtn = document.createElement("button");
    delBtn.title       = "削除";
    delBtn.textContent = "🗑";
    delBtn.onclick = (e) => { e.stopPropagation(); deleteCat(i); };

    row.appendChild(nameEl);
    row.appendChild(renameBtn);
    row.appendChild(delBtn);
    box.appendChild(row);
  });

  const addWrap = document.createElement("div");
  addWrap.className = "category-add-row";

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "category-add-btn";
  addBtn.textContent = "＋ カテゴリを追加";
  addBtn.onclick = (e) => {
    e.stopPropagation();
    addCat();
  };

  addWrap.appendChild(addBtn);
  box.appendChild(addWrap);
}

// ─────────────────────────────────────────────
//  メインrender
// ─────────────────────────────────────────────
function render() {
  applyTheme();
  renderTabs();
  renderMemos();
  save();
}

// ─────────────────────────────────────────────
//  エディタ
//  backToModal=true の場合、閉じたらカテゴリモーダルへ戻る
// ─────────────────────────────────────────────
function openEditor(index = null, catIdx = null, backToModal = false) {
  editingIndex  = index;
  editingCatIdx = catIdx !== null ? catIdx : data.active;
  returnToModal = backToModal;
  selectingMemoBody = false;
  skipNextEditorBackdropClose = false;

  const isEdit = index !== null;
  document.getElementById("editorTitle").textContent = isEdit ? "メモを編集" : "メモを作成";

  const memo = isEdit ? data.memos[editingCatIdx][index] : { title: "", text: "" };
  document.getElementById("memoTitleInput").value = memo.title || "";
  document.getElementById("memoBodyInput").value  = memo.text  || "";
  document.getElementById("memoEditorModal").classList.remove("hidden");
  setTimeout(() => document.getElementById("memoTitleInput").focus(), 50);
}

function closeEditor() {
  document.getElementById("memoEditorModal").classList.add("hidden");
  editingIndex  = null;
  editingCatIdx = null;

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
    data.memos[data.active].push({ title, text, created: now, updated: null });
  } else {
    const existing = data.memos[editingCatIdx][editingIndex];
    data.memos[editingCatIdx][editingIndex] = {
      title,
      text,
      created: existing ? existing.created : now,
      updated: now
    };
    data.active = editingCatIdx;
  }

  closeEditor();
  render();
}

// ─────────────────────────────────────────────
//  CRUD
// ─────────────────────────────────────────────
function add() { openEditor(null, null, false); }

function del(i) {
  confirmDelete((ok) => {
    if (!ok) return;
    data.memos[data.active].splice(i, 1);
    render();
  });
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

function addCat() {
  const categoryModalOpen = !document.getElementById("categoryModal").classList.contains("hidden");
  openCatNameModal("カテゴリを追加", "", (name) => {
    data.cats.push(name);
    data.memos.push([]);
    data.active = data.cats.length - 1;
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
    data.cats.splice(i, 1);
    data.memos.splice(i, 1);
    if (data.active >= data.cats.length) data.active = data.cats.length - 1;
    closeModal();
    render();
    scrollActiveTabIntoView();
  });
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
  render();
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
  renderCategoryModal();
  document.getElementById("categoryModal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("categoryModal").classList.add("hidden");
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

// FAB・フローティングメニュー
plusBtn.onclick = toggleFloat;
document.getElementById("floatMemoBtn").onclick     = () => { closeFloat(); add(); };
document.getElementById("floatCategoryBtn").onclick = () => { closeFloat(); addCat(); };
floatBackdrop.onclick = (e) => { if (e.target.id === "floatMenuBackdrop") closeFloat(); };

// エディタ
document.getElementById("cancelMemoBtn").onclick  = closeEditor;
document.getElementById("saveMemoBtn").onclick    = saveEditor;
document.getElementById("memoBodyInput").addEventListener("pointerdown", () => {
  selectingMemoBody = true;
});
window.addEventListener("pointerup", () => {
  if (!selectingMemoBody) return;
  selectingMemoBody = false;
  const bodyInput = document.getElementById("memoBodyInput");
  if (bodyInput.selectionStart !== bodyInput.selectionEnd) {
    skipNextEditorBackdropClose = true;
    setTimeout(() => { skipNextEditorBackdropClose = false; }, 250);
  }
}, true);
document.getElementById("memoEditorModal").onclick = (e) => {
  if (e.target.id !== "memoEditorModal") return;
  if (skipNextEditorBackdropClose) {
    skipNextEditorBackdropClose = false;
    return;
  }
  closeEditor();
};

// カテゴリ名入力モーダル
document.getElementById("cancelCatBtn").onclick = closeCatNameModal;
document.getElementById("saveCatBtn").onclick   = saveCatName;
document.getElementById("catNameInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveCatName();
  if (e.key === "Escape") closeCatNameModal();
});
document.getElementById("catNameModal").onclick = (e) => {
  if (e.target.id === "catNameModal") closeCatNameModal();
};

// カテゴリモーダル
document.getElementById("menuBtn").onclick        = openModal;
document.getElementById("closeModalBtn").onclick  = closeModal;
document.getElementById("categoryModal").onclick  = (e) => {
  if (e.target.id === "categoryModal") closeModal();
};

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

// テーマ
document.getElementById("themeBtn").onclick = () => { data.dark = !data.dark; render(); };

// ─────────────────────────────────────────────
//  バックアップ モジュール
//  将来: Google Drive・任意フォルダ対応はここに追加する
// ─────────────────────────────────────────────

const Backup = {
  /** バックアップJSONのBlobを生成 */
  makeBlob() {
    return new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  },

  /** ファイル名を生成 */
  makeFilename() {
    const d = new Date().toLocaleDateString("ja-JP").replace(/\//g, "-");
    return `tab-memo-backup_${d}.json`;
  },

  /** 端末にダウンロード保存 */
  saveLocal() {
    const a  = document.createElement("a");
    a.href   = URL.createObjectURL(Backup.makeBlob());
    a.download = Backup.makeFilename();
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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
      const writable = await handle.createWritable();
      await writable.write(Backup.makeBlob());
      await writable.close();
      closeBackupModal();
    } catch (e) {
      if (e.name !== "AbortError") alert("保存に失敗しました。");
    }
  }
};

function openBackupModal()  { document.getElementById("backupModal").classList.remove("hidden"); }
function closeBackupModal() { document.getElementById("backupModal").classList.add("hidden"); }

// バックアップ
document.getElementById("backupBtn").onclick          = openBackupModal;
document.getElementById("cancelBackupBtn").onclick    = closeBackupModal;
document.getElementById("backupLocalBtn").onclick     = () => { Backup.saveCustomPath(); };
document.getElementById("backupGdriveBtn").onclick    = Backup.saveGdrive;
document.getElementById("backupModal").onclick        = (e) => {
  if (e.target.id === "backupModal") closeBackupModal();
};

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
render();
setupSwipe();
setupResizeHandler();
setTimeout(scrollActiveTabIntoView, 100);

