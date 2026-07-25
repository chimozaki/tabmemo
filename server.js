const http = require("http");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");

const ROOT_DIR = __dirname;
const DATA_DIR = process.env.TABMEMO_DATA_DIR || path.join(ROOT_DIR, "data");
const DATA_FILE = path.join(DATA_DIR, "tabmemo-data.json");
const PREVIOUS_FILE = path.join(DATA_DIR, "tabmemo-data.previous.json");
const TEMP_FILE = path.join(DATA_DIR, "tabmemo-data.tmp");
const HOST = "127.0.0.1";
const PORT = Number(process.env.TABMEMO_PORT || 4174);
const MAX_BODY_BYTES = 5 * 1024 * 1024;

const STATIC_FILES = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/app.js", "app.js"],
  ["/style.css", "style.css"],
  ["/manifest.json", "manifest.json"],
  ["/sw.js", "sw.js"],
  ["/icon.svg", "icon.svg"],
  ["/icon-maskable.svg", "icon-maskable.svg"],
  ["/tabmemo_exsample.png", "tabmemo_exsample.png"]
]);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

let saveChain = Promise.resolve();

function sendJson(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function isValidData(value) {
  return value
    && typeof value === "object"
    && Array.isArray(value.cats)
    && Array.isArray(value.memos);
}

async function readData() {
  try {
    const raw = await fsp.readFile(DATA_FILE, "utf8");
    const data = JSON.parse(raw);
    if (!isValidData(data)) throw new Error("invalid data shape");
    return { exists: true, data };
  } catch (error) {
    if (error.code === "ENOENT") return { exists: false, data: null };
    throw error;
  }
}

async function persistData(data) {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  const next = `${JSON.stringify(data, null, 2)}\n`;

  let current = null;
  try {
    current = await fsp.readFile(DATA_FILE, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  if (current === next) return;
  if (current !== null) await fsp.copyFile(DATA_FILE, PREVIOUS_FILE);
  await fsp.writeFile(TEMP_FILE, next, "utf8");
  await fsp.rename(TEMP_FILE, DATA_FILE);
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("request too large"), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function handleApi(req, res, pathname) {
  if (pathname === "/api/health" && req.method === "GET") {
    sendJson(res, 200, { app: "tabmemo", ok: true });
    return;
  }

  if (pathname !== "/api/data") {
    sendJson(res, 404, { error: "not found" });
    return;
  }

  if (req.method === "GET") {
    sendJson(res, 200, await readData());
    return;
  }

  if (req.method === "POST") {
    const raw = await readRequestBody(req);
    const data = JSON.parse(raw);
    if (!isValidData(data)) {
      sendJson(res, 400, { error: "invalid data" });
      return;
    }

    saveChain = saveChain
      .catch(() => {})
      .then(() => persistData(data));
    await saveChain;
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 405, { error: "method not allowed" });
}

async function handleStatic(req, res, pathname) {
  const relativePath = STATIC_FILES.get(pathname);
  if (!relativePath || req.method !== "GET") {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const filePath = path.join(ROOT_DIR, relativePath);
  const stat = await fsp.stat(filePath);
  res.writeHead(200, {
    "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
    "Content-Length": stat.size,
    "Cache-Control": "no-store"
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url.pathname);
    } else {
      await handleStatic(req, res, url.pathname);
    }
  } catch (error) {
    console.error(error);
    if (!res.headersSent) sendJson(res, error.statusCode || 500, { error: "server error" });
    else res.end();
  }
});

server.listen(PORT, HOST, () => {
  console.log(`TabMemo local server: http://localhost:${PORT}/`);
  console.log(`Data file: ${DATA_FILE}`);
});
