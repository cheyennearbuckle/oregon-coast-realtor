const express = require("express");
const path = require("path");
const fs = require("fs");
const https = require("https");
const multer = require("multer");

const app = express();

// ── Admin Auth ──
const ADMIN_KEY = "CoastalAdmin2026!";

// ── GitHub persistence (optional) ──
// Render's filesystem is ephemeral: anything written to disk (posts.json,
// uploaded images) disappears the next time the service redeploys. To make
// admin-panel changes durable, every write is also committed in the
// background to this repo's own GitHub tree, which becomes the real source
// of truth. Requires a GITHUB_TOKEN env var (a GitHub token with "Contents:
// Read and write" permission on this repo) to be set in Render → this
// service → Environment. Without it, the site behaves exactly as before
// (local-only, ephemeral) and logs a warning instead of failing.
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GITHUB_OWNER = "cheyennearbuckle";
const GITHUB_REPO = "oregon-coast-realtor";
const GITHUB_BRANCH = "main";

function githubRequest(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: "api.github.com",
      path: apiPath,
      method,
      headers: {
        "User-Agent": "oregon-coast-realtor-blog-sync",
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "Accept": "application/vnd.github+json",
        ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {})
      }
    };
    const req = https.request(options, (res) => {
      let chunks = "";
      res.on("data", (c) => (chunks += c));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(chunks || "{}")); } catch (e) { resolve({}); }
        } else {
          reject(new Error(`GitHub API ${res.statusCode}: ${chunks}`));
        }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

// Best-effort: commit a file's current contents into the repo. Never throws —
// failures (missing token, network issue, bad permissions) are logged only,
// so the live admin workflow always keeps working even if syncing fails.
async function commitFileToGitHub(repoPath, contentBuffer, message) {
  if (!GITHUB_TOKEN) {
    console.warn(`[github-sync] Skipped commit of ${repoPath} — GITHUB_TOKEN is not configured.`);
    return;
  }
  try {
    let sha;
    try {
      const existing = await githubRequest(
        "GET",
        `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${repoPath}?ref=${GITHUB_BRANCH}`
      );
      sha = existing.sha;
    } catch (e) {
      // File doesn't exist in the repo yet — that's fine, we'll create it.
    }
    await githubRequest(
      "PUT",
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${repoPath}`,
      {
        message,
        content: contentBuffer.toString("base64"),
        branch: GITHUB_BRANCH,
        ...(sha ? { sha } : {})
      }
    );
    console.log(`[github-sync] Committed ${repoPath}`);
  } catch (e) {
    console.error(`[github-sync] Failed to commit ${repoPath}:`, e.message);
  }
}

// Fire-and-forget sync of the full posts list into data/posts.json in the
// repo, so the next redeploy starts from the latest admin-panel state
// instead of whatever was last checked in by hand.
function syncPostsToGitHub(posts) {
  commitFileToGitHub(
    "data/posts.json",
    Buffer.from(JSON.stringify(posts, null, 2)),
    "Sync blog posts from admin panel"
  ).catch(() => {});
}

// ── Ensure directories exist ──
const DATA_DIR = path.join(__dirname, "data");
const UPLOADS_DIR = path.join(__dirname, "assets", "uploads");
const POSTS_FILE = path.join(DATA_DIR, "posts.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(POSTS_FILE)) fs.writeFileSync(POSTS_FILE, JSON.stringify([]));

// ── Multer config ──
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = Date.now() + "-" + Math.random().toString(36).slice(2, 8) + ext;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, and WebP images are allowed"));
    }
  }
});

// ── Parse form data ──
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ── Serve static files ──
app.use(express.static(__dirname));
app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use("/assets/uploads", express.static(UPLOADS_DIR));

// ── Lead capture endpoint ──
const LEAD_EMAIL = "Cheyenne@pacificpropertiesteam.com";

app.post("/api/lead", (req, res) => {
  const { name, email, phone, message, type, address, subject, _to } = req.body;
  const lead = { name, email, phone, type: type || subject, message, address, sentTo: _to || LEAD_EMAIL, timestamp: new Date().toISOString() };
  console.log("\n===== NEW LEAD =====");
  console.log(JSON.stringify(lead, null, 2));
  console.log("===================\n");
  res.json({ success: true, message: "Thank you! Cheyenne will be in touch within one business day." });
});

// ── Newsletter signup ──
app.post("/api/newsletter", (req, res) => {
  const { email, _to } = req.body;
  console.log("\n===== NEWSLETTER SIGNUP =====");
  console.log("Email:", email, "| Route to:", _to || LEAD_EMAIL);
  console.log("=============================\n");
  res.json({ success: true, message: "You're on the list! Watch your inbox for Oregon Coast market updates." });
});

// ── Auth middleware ──
function requireAuth(req, res, next) {
  const key = req.headers["x-admin-key"];
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ── Posts helpers ──
function readPosts() {
  try {
    return JSON.parse(fs.readFileSync(POSTS_FILE, "utf8"));
  } catch (e) {
    return [];
  }
}

function writePosts(posts) {
  fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
  // Persist beyond this deploy — see GitHub persistence note above.
  syncPostsToGitHub(posts);
}

// ── Blog API ──

// GET /api/posts — all published posts, newest first
app.get("/api/posts", (req, res) => {
  const posts = readPosts()
    .filter(p => p.status === "published")
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  res.json(posts);
});

// GET /api/posts/all — all posts including drafts (requires auth)
app.get("/api/posts/all", requireAuth, (req, res) => {
  const posts = readPosts()
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  res.json(posts);
});

// GET /api/posts/:id — single post
app.get("/api/posts/:id", (req, res) => {
  const posts = readPosts();
  const post = posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });
  res.json(post);
});

// POST /api/posts — create new post (requires auth)
app.post("/api/posts", requireAuth, (req, res) => {
  const posts = readPosts();
  const { title, slug, category, excerpt, content, image, status, listing } = req.body;

  if (!title) return res.status(400).json({ error: "Title is required" });

  const id = "post-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
  const generatedSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const post = {
    id,
    title,
    slug: generatedSlug,
    category: category || "market-update",
    excerpt: excerpt || "",
    content: content || "",
    image: image || "",
    publishedAt: new Date().toISOString(),
    status: status || "draft"
  };

  if (category === "listing" && listing) {
    post.listing = listing;
  }

  posts.push(post);
  writePosts(posts);
  res.status(201).json(post);
});

// PUT /api/posts/:id — update post (requires auth)
app.put("/api/posts/:id", requireAuth, (req, res) => {
  const posts = readPosts();
  const idx = posts.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Post not found" });

  const { title, slug, category, excerpt, content, image, status, listing } = req.body;

  const updated = { ...posts[idx] };
  if (title !== undefined) updated.title = title;
  if (slug !== undefined) updated.slug = slug;
  if (category !== undefined) updated.category = category;
  if (excerpt !== undefined) updated.excerpt = excerpt;
  if (content !== undefined) updated.content = content;
  if (image !== undefined) updated.image = image;
  if (status !== undefined) updated.status = status;

  if (category === "listing" && listing) {
    updated.listing = listing;
  } else if (category !== "listing") {
    delete updated.listing;
  }

  posts[idx] = updated;
  writePosts(posts);
  res.json(updated);
});

// DELETE /api/posts/:id — delete post (requires auth)
app.delete("/api/posts/:id", requireAuth, (req, res) => {
  const posts = readPosts();
  const idx = posts.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Post not found" });
  posts.splice(idx, 1);
  writePosts(posts);
  res.json({ success: true });
});

// POST /api/upload — upload image (requires auth)
app.post("/api/upload", requireAuth, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const url = "/assets/uploads/" + req.file.filename;
  res.json({ url });

  // Persist the uploaded image beyond this deploy — see GitHub persistence
  // note above. Runs after the response so uploads stay fast in the admin UI.
  fs.readFile(path.join(UPLOADS_DIR, req.file.filename), (err, buf) => {
    if (err) return;
    commitFileToGitHub(
      "assets/uploads/" + req.file.filename,
      buf,
      "Add uploaded blog image " + req.file.filename
    ).catch(() => {});
  });
});

// ── Short alias redirects — friendly links (e.g. /blog2195Garfield or /2195Garfield) ──
// Map a short, memorable alias to a post's full canonical slug. 301-redirect so
// there's still ONE canonical URL for SEO, but you can hand out the short link.
app.get("/:alias", (req, res, next) => {
  const raw = req.params.alias;
  if (!raw || raw.includes(".")) return next(); // skip files like robots.txt
  // Accept both "/2195garfield" and "/blog2195garfield" (optional "blog" prefix)
  const alias = raw.toLowerCase();
  const aliasNoPrefix = alias.replace(/^blog/, "");
  const posts = readPosts();
  const post = posts.find(p => {
    if (p.status !== "published" || !p.alias) return false;
    const a = p.alias.toLowerCase();
    return a === alias || a === aliasNoPrefix;
  });
  if (post) {
    return res.redirect(301, `/blog/${post.slug}`);
  }
  return next();
});

// ── Per-page meta for share previews (Facebook, Google Business, texts, LinkedIn) ──
// index.html ships with homepage og:/twitter: tags. Social crawlers read the FIRST
// og:url/og:title/og:image they find, so we must REPLACE those tags (not append),
// otherwise every shared blog link previews — and resolves — as the homepage.
const SITE = "https://oregoncoastrealtors.com";
function escAttr(v) {
  return String(v == null ? "" : v)
    .replace(/&(?!(?:amp|lt|gt|quot|#\d+);)/g, "&amp;")
    .replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function absImage(img) {
  if (!img) return SITE + "/assets/hero-home.jpg";
  if (/^https?:\/\//i.test(img)) return img;
  return SITE + (img.startsWith("/") ? img : "/" + img);
}
function renderWithMeta(indexHtml, m) {
  const title = escAttr(m.title), desc = escAttr(m.desc), url = escAttr(m.url);
  const img = escAttr(m.image), alt = escAttr(m.imageAlt || m.title);
  let html = indexHtml
    // strip the homepage's social tags + canonical so only one set exists
    .replace(/\s*<meta\s+property="og:[^"]*"[^>]*>/g, "")
    .replace(/\s*<meta\s+name="twitter:[^"]*"[^>]*>/g, "")
    .replace(/\s*<link\s+rel="canonical"[^>]*>/g, "")
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${desc}">`);
  const tags =
    `  <link rel="canonical" href="${url}">\n` +
    (m.noindex ? `  <meta name="robots" content="noindex, follow">\n` : "") +
    `  <meta property="og:type" content="${m.type || "website"}">\n` +
    `  <meta property="og:site_name" content="Cheyenne Sells Oregon">\n` +
    `  <meta property="og:locale" content="en_US">\n` +
    `  <meta property="og:url" content="${url}">\n` +
    `  <meta property="og:title" content="${title}">\n` +
    `  <meta property="og:description" content="${desc}">\n` +
    `  <meta property="og:image" content="${img}">\n` +
    `  <meta property="og:image:secure_url" content="${img}">\n` +
    `  <meta property="og:image:alt" content="${alt}">\n` +
    `  <meta name="twitter:card" content="summary_large_image">\n` +
    `  <meta name="twitter:title" content="${title}">\n` +
    `  <meta name="twitter:description" content="${desc}">\n` +
    `  <meta name="twitter:image" content="${img}">\n`;
  return html.replace("</head>", tags + "</head>");
}

// ── Blog listing page (/blog) — its own canonical + share preview ──
app.get(["/blog", "/blog/"], (req, res) => {
  const indexHtml = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(renderWithMeta(indexHtml, {
    url: `${SITE}/blog`,
    title: "Oregon Coast Real Estate Blog | Cheyenne Arbuckle, Coos Bay Realtor",
    desc: "New listings, market updates and local guides for Coos Bay, North Bend, Bandon and the Southern Oregon Coast from Cheyenne Arbuckle, Pacific Properties.",
    image: `${SITE}/assets/hero-home.jpg`,
  }));
});

// ── Blog post SSR — inject canonical + OG meta per post for Google & social shares ──
app.get("/blog/:slug", (req, res) => {
  const posts = readPosts();
  const slug = String(req.params.slug || "").toLowerCase();
  const indexHtml = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  let post = posts.find(p => p.status === "published" && String(p.slug).toLowerCase() === slug);

  // Forgiving lookups so hand-typed / shortened links still work:
  // /blog/<alias>  (e.g. /blog/2195Garfield or /blog/blog2195Garfield)
  if (!post) {
    const a = slug.replace(/^blog/, "");
    post = posts.find(p => p.status === "published" && p.alias &&
      (p.alias.toLowerCase() === slug || p.alias.toLowerCase() === a));
  }
  if (post && post.slug !== req.params.slug) {
    return res.redirect(301, `/blog/${post.slug}`);
  }

  if (!post) {
    // Slug not found — return 404 so Google stops indexing phantom URLs
    res.status(404).setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(renderWithMeta(indexHtml, {
      url: `${SITE}/blog`, noindex: true,
      title: "Post not found | Oregon Coast Realtor – Cheyenne Arbuckle",
      desc: "This post may have moved. Browse the latest Southern Oregon Coast listings and guides from Cheyenne Arbuckle.",
      image: `${SITE}/assets/hero-home.jpg`,
    }));
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(renderWithMeta(indexHtml, {
    type: "article",
    url: `${SITE}/blog/${post.slug}`,
    title: `${post.title} | Oregon Coast Realtor – Cheyenne Arbuckle`,
    desc: post.excerpt || "Oregon Coast real estate insights from Cheyenne Arbuckle, Pacific Properties.",
    image: absImage(post.image),
    imageAlt: post.title,
  }));
});

// ── SPA fallback — serve index.html for any unmatched route ──
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => console.log(`Cheyenne Sells Oregon — listening on port ${PORT}`));
