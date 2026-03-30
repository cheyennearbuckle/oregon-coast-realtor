const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const app = express();

// ── Admin Auth ──
const ADMIN_KEY = "CoastalAdmin2026!";

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
});

// ── SPA fallback — serve index.html for any unmatched route ──
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => console.log(`Cheyenne Sells Oregon — listening on port ${PORT}`));
