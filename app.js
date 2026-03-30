/* ========================================
   Cheyenne Sells Oregon — App Router & Interactions
   ======================================== */

(function() {
  const root = document.documentElement;

  // ── Dark Mode Toggle ──
  const themeBtn = document.querySelector('[data-theme-toggle]');
  let theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  root.setAttribute('data-theme', theme);
  updateThemeIcon();

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      theme = theme === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', theme);
      updateThemeIcon();
    });
  }

  function updateThemeIcon() {
    if (!themeBtn) return;
    themeBtn.setAttribute('aria-label', 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' mode');
    themeBtn.innerHTML = theme === 'dark'
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
      : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }

  // ── Mobile Nav Toggle ──
  const navToggle = document.querySelector('.nav-toggle');
  const mainNav = document.querySelector('.main-nav');

  if (navToggle && mainNav) {
    navToggle.addEventListener('click', () => {
      mainNav.classList.toggle('open');
      const isOpen = mainNav.classList.contains('open');
      navToggle.setAttribute('aria-expanded', isOpen);
      navToggle.innerHTML = isOpen
        ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>'
        : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>';
    });
  }

  // ── Header scroll effect ──
  const header = document.querySelector('.site-header');
  window.addEventListener('scroll', () => {
    if (header) {
      header.classList.toggle('site-header--scrolled', window.scrollY > 20);
    }
  }, { passive: true });

  // ── Hash Router ──
  const pages = document.querySelectorAll('.page');
  const navLinks = document.querySelectorAll('.main-nav a[href^="#"]');

  function navigate() {
    const hash = location.hash || '#home';
    const pageId = hash.slice(1);
    pages.forEach(p => {
      p.style.display = p.id === pageId ? '' : 'none';
    });
    navLinks.forEach(l => {
      l.classList.toggle('active', l.getAttribute('href') === hash);
    });
    // Close mobile nav
    if (mainNav) mainNav.classList.remove('open');
    if (navToggle) {
      navToggle.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>';
    }
    window.scrollTo(0, 0);

    // Page-specific init
    if (pageId === 'blog') initBlogPage();
    if (pageId === 'admin') initAdminPage();
  }

  let blogPostsCache = null;
  let adminKey = '';
  let adminInitialized = false;
  let editingPostId = null;

  window.addEventListener('hashchange', navigate);
  navigate();

  // ── Form Submissions ──
  document.addEventListener('submit', async (e) => {
    const form = e.target;
    if (!form.dataset.endpoint) return;
    e.preventDefault();

    const data = Object.fromEntries(new FormData(form));
    const btn = form.querySelector('button[type="submit"]');
    const origText = btn.textContent;
    btn.textContent = 'Sending...';
    btn.disabled = true;

    try {
      const res = await fetch(form.dataset.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await res.json();

      const successEl = form.querySelector('.form-success');
      if (successEl) {
        form.querySelectorAll('.form-grid, .form-group, button[type="submit"], p').forEach(el => el.style.display = 'none');
        successEl.style.display = 'block';
        successEl.textContent = result.message || 'Thank you! We\'ll be in touch.';
      } else {
        btn.textContent = 'Sent!';
        setTimeout(() => { btn.textContent = origText; btn.disabled = false; }, 3000);
      }
      form.reset();
    } catch (err) {
      btn.textContent = 'Error — Try Again';
      btn.disabled = false;
      setTimeout(() => { btn.textContent = origText; }, 3000);
    }
  });

  // ── Smooth in-page scroll for anchor links ──
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const href = link.getAttribute('href');
    if (href.length <= 1 || !href.includes('-')) return;
  });


  /* ========================================
     BLOG PAGE
     ======================================== */

  async function initBlogPage() {
    if (blogPostsCache !== null) {
      renderBlogPosts(blogPostsCache);
      return;
    }
    showBlogLoading();
    try {
      const res = await fetch('/api/posts');
      const posts = await res.json();
      blogPostsCache = posts;
      renderBlogPosts(posts);
    } catch (err) {
      showBlogError();
    }
  }

  function showBlogLoading() {
    const grid = document.getElementById('blog-grid');
    if (!grid) return;
    grid.innerHTML = `
      <div class="blog-loading" aria-live="polite">
        <div class="blog-loading-spinner"></div>
        <p>Loading posts&hellip;</p>
      </div>`;
  }

  function showBlogError() {
    const grid = document.getElementById('blog-grid');
    if (!grid) return;
    grid.innerHTML = `
      <div class="blog-empty">
        <div class="blog-empty-icon">⚡</div>
        <h3>Couldn't load posts</h3>
        <p>Check your connection and try refreshing.</p>
      </div>`;
  }

  function renderBlogPosts(posts) {
    const grid = document.getElementById('blog-grid');
    if (!grid) return;

    if (!posts || posts.length === 0) {
      grid.innerHTML = `
        <div class="blog-empty">
          <div class="blog-empty-icon">🌊</div>
          <h3>Coming Soon</h3>
          <p>Real estate insights and Oregon Coast updates are on the way. Check back soon!</p>
        </div>`;
      return;
    }

    grid.innerHTML = posts.map(post => buildBlogCard(post)).join('');

    // Attach click handlers
    grid.querySelectorAll('.blog-card[data-post-id]').forEach(card => {
      card.addEventListener('click', () => {
        const postId = card.dataset.postId;
        const post = posts.find(p => p.id === postId);
        if (post) openBlogModal(post);
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.click();
        }
      });
    });
  }

  function buildBlogCard(post) {
    const imgHtml = post.image
      ? `<div class="card-img"><img src="${escHtml(post.image)}" alt="${escHtml(post.title)}" loading="lazy"></div>`
      : '';

    const categoryLabel = categoryName(post.category);
    const dateStr = formatDate(post.publishedAt);

    const listingBar = (post.category === 'listing' && post.listing)
      ? buildListingBar(post.listing)
      : '';

    return `
      <article class="blog-card" data-post-id="${escHtml(post.id)}" role="button" tabindex="0" aria-label="Read: ${escHtml(post.title)}" style="cursor:pointer;">
        ${imgHtml}
        <div class="blog-card-body">
          <span class="blog-card-tag">${escHtml(categoryLabel)}</span>
          <p class="blog-card-meta"><time datetime="${escHtml(post.publishedAt)}">${dateStr}</time></p>
          <h3>${escHtml(post.title)}</h3>
          ${post.excerpt ? `<p>${escHtml(post.excerpt)}</p>` : ''}
        </div>
        ${listingBar}
      </article>`;
  }

  function buildListingBar(listing) {
    const statusClass = listing.status
      ? 'listing-status--' + listing.status.toLowerCase()
      : 'listing-status--active';
    return `
      <div class="listing-bar">
        ${listing.price ? `<span class="listing-bar-item listing-price">${escHtml(listing.price)}</span>` : ''}
        ${listing.beds ? `<span class="listing-bar-item"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 22v-9M21 22v-9M3 8l9-5 9 5v5H3z"/></svg>${escHtml(String(listing.beds))} bd</span>` : ''}
        ${listing.baths ? `<span class="listing-bar-item">${escHtml(String(listing.baths))} ba</span>` : ''}
        ${listing.sqft ? `<span class="listing-bar-item">${escHtml(String(listing.sqft))} sqft</span>` : ''}
        ${listing.status ? `<span class="listing-status ${statusClass}">${escHtml(listing.status)}</span>` : ''}
      </div>`;
  }

  // ── Blog Modal ──
  const blogModal = document.getElementById('blog-modal');
  const blogModalClose = document.getElementById('blog-modal-close');
  const blogModalOverlay = document.getElementById('blog-modal-overlay');

  if (blogModalClose) blogModalClose.addEventListener('click', closeBlogModal);
  if (blogModalOverlay) blogModalOverlay.addEventListener('click', closeBlogModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && blogModal && blogModal.style.display !== 'none') {
      closeBlogModal();
    }
  });

  function openBlogModal(post) {
    if (!blogModal) return;

    const imgWrap = document.getElementById('blog-modal-img-wrap');
    const img = document.getElementById('blog-modal-img');
    const meta = document.getElementById('blog-modal-meta');
    const title = document.getElementById('blog-modal-title');
    const listingBar = document.getElementById('blog-modal-listing-bar');
    const text = document.getElementById('blog-modal-text');

    if (post.image) {
      img.src = post.image;
      img.alt = post.title;
      imgWrap.style.display = '';
    } else {
      imgWrap.style.display = 'none';
    }

    meta.innerHTML = `<time datetime="${escHtml(post.publishedAt)}">${formatDate(post.publishedAt)}</time> &nbsp;&middot;&nbsp; ${escHtml(categoryName(post.category))}`;
    title.textContent = post.title;

    if (post.category === 'listing' && post.listing) {
      listingBar.style.display = '';
      listingBar.innerHTML = buildModalListingBar(post.listing);
    } else {
      listingBar.style.display = 'none';
    }

    // Render content — if it looks like HTML, inject; otherwise wrap in paragraphs
    if (post.content) {
      const isHtml = /<[a-z][\s\S]*>/i.test(post.content);
      if (isHtml) {
        text.innerHTML = post.content;
      } else {
        text.innerHTML = post.content
          .split(/\n\n+/)
          .map(p => `<p>${escHtml(p.trim())}</p>`)
          .join('');
      }
    } else if (post.excerpt) {
      text.innerHTML = `<p>${escHtml(post.excerpt)}</p>`;
    } else {
      text.innerHTML = '<p>No content yet.</p>';
    }

    blogModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    blogModalClose.focus();
  }

  function closeBlogModal() {
    if (!blogModal) return;
    blogModal.style.display = 'none';
    document.body.style.overflow = '';
  }

  function buildModalListingBar(listing) {
    const items = [];
    if (listing.address) items.push(`<span><strong>Address:</strong> ${escHtml(listing.address)}</span>`);
    if (listing.price) items.push(`<span><strong>Price:</strong> ${escHtml(listing.price)}</span>`);
    if (listing.beds) items.push(`<span><strong>Beds:</strong> ${escHtml(String(listing.beds))}</span>`);
    if (listing.baths) items.push(`<span><strong>Baths:</strong> ${escHtml(String(listing.baths))}</span>`);
    if (listing.sqft) items.push(`<span><strong>Sqft:</strong> ${escHtml(String(listing.sqft))}</span>`);
    if (listing.mlsNumber) items.push(`<span><strong>MLS#:</strong> ${escHtml(listing.mlsNumber)}</span>`);
    if (listing.status) items.push(`<span><strong>Status:</strong> ${escHtml(listing.status)}</span>`);
    return items.join('');
  }


  /* ========================================
     ADMIN PAGE
     ======================================== */

  function initAdminPage() {
    if (adminInitialized) return;
    adminInitialized = true;
    bindAdminAuth();
    bindAdminDashboard();
  }

  function bindAdminAuth() {
    const loginBtn = document.getElementById('admin-login-btn');
    const passwordInput = document.getElementById('admin-password');
    const authError = document.getElementById('admin-auth-error');

    if (!loginBtn) return;

    const doLogin = () => {
      const pwd = passwordInput.value.trim();
      if (!pwd) return;
      // We verify by making a real API call
      fetch('/api/posts/all', {
        headers: { 'X-Admin-Key': pwd }
      }).then(res => {
        if (res.ok) {
          adminKey = pwd;
          authError.style.display = 'none';
          document.getElementById('admin-auth').style.display = 'none';
          document.getElementById('admin-dashboard').style.display = '';
          loadAdminPosts();
        } else {
          authError.style.display = 'block';
          passwordInput.value = '';
          passwordInput.focus();
        }
      }).catch(() => {
        authError.style.display = 'block';
      });
    };

    loginBtn.addEventListener('click', doLogin);
    passwordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doLogin();
    });
  }

  function bindAdminDashboard() {
    const newPostBtn = document.getElementById('admin-new-post-btn');
    const logoutBtn = document.getElementById('admin-logout-btn');
    const cancelBtn = document.getElementById('admin-cancel-btn');
    const categorySelect = document.getElementById('admin-post-category');
    const postForm = document.getElementById('admin-post-form');
    const uploadZone = document.getElementById('admin-upload-zone');
    const imageInput = document.getElementById('admin-image-input');
    const removeImageBtn = document.getElementById('admin-remove-image-btn');

    if (newPostBtn) newPostBtn.addEventListener('click', () => showEditor(null));
    if (cancelBtn) cancelBtn.addEventListener('click', showPostList);
    if (logoutBtn) logoutBtn.addEventListener('click', adminLogout);

    // Category change → show/hide listing section
    if (categorySelect) {
      categorySelect.addEventListener('change', () => {
        const listingSection = document.getElementById('admin-listing-section');
        if (listingSection) {
          listingSection.style.display = categorySelect.value === 'listing' ? '' : 'none';
        }
      });
    }

    // Form submit
    if (postForm) {
      postForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await savePost();
      });
    }

    // Upload zone
    if (uploadZone && imageInput) {
      uploadZone.addEventListener('click', () => imageInput.click());
      uploadZone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); imageInput.click(); }
      });

      uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
      });
      uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
      uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) handleImageUpload(file);
      });

      imageInput.addEventListener('change', () => {
        if (imageInput.files[0]) handleImageUpload(imageInput.files[0]);
      });
    }

    if (removeImageBtn) {
      removeImageBtn.addEventListener('click', () => {
        document.getElementById('admin-post-image').value = '';
        document.getElementById('admin-image-preview').style.display = 'none';
        document.getElementById('admin-upload-zone').style.display = '';
        if (imageInput) imageInput.value = '';
      });
    }
  }

  function adminLogout() {
    adminKey = '';
    adminInitialized = false;
    editingPostId = null;
    document.getElementById('admin-auth').style.display = '';
    document.getElementById('admin-dashboard').style.display = 'none';
    document.getElementById('admin-password').value = '';
    document.getElementById('admin-auth-error').style.display = 'none';
    showPostList();
  }

  async function loadAdminPosts() {
    try {
      const res = await fetch('/api/posts/all', {
        headers: { 'X-Admin-Key': adminKey }
      });
      const posts = await res.json();
      renderAdminPostsTable(posts);
    } catch (err) {
      console.error('Failed to load posts:', err);
    }
  }

  function renderAdminPostsTable(posts) {
    const tbody = document.getElementById('admin-posts-tbody');
    const countEl = document.getElementById('admin-post-count');
    if (!tbody) return;

    if (countEl) {
      countEl.textContent = posts.length + ' post' + (posts.length !== 1 ? 's' : '');
    }

    if (posts.length === 0) {
      tbody.innerHTML = `<tr id="admin-posts-empty"><td colspan="5" class="admin-table-empty">No posts yet. Create your first post!</td></tr>`;
      return;
    }

    tbody.innerHTML = posts.map(post => {
      const statusClass = post.status === 'published' ? 'admin-status-badge--published' : 'admin-status-badge--draft';
      const statusLabel = post.status === 'published' ? 'Published' : 'Draft';
      const dateStr = formatDate(post.publishedAt);
      return `
        <tr data-post-id="${escHtml(post.id)}">
          <td class="post-title-cell"><span class="post-title-text">${escHtml(post.title)}</span></td>
          <td><span class="admin-category-pill">${escHtml(categoryName(post.category))}</span></td>
          <td><span class="admin-status-badge ${statusClass}">${statusLabel}</span></td>
          <td>${dateStr}</td>
          <td class="admin-table-actions">
            <button class="admin-btn-edit" data-post-id="${escHtml(post.id)}">Edit</button>
            <button class="admin-btn-delete" data-post-id="${escHtml(post.id)}">Delete</button>
          </td>
        </tr>`;
    }).join('');

    // Bind edit/delete buttons
    tbody.querySelectorAll('.admin-btn-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const postId = btn.dataset.postId;
        const post = posts.find(p => p.id === postId);
        if (post) showEditor(post);
      });
    });

    tbody.querySelectorAll('.admin-btn-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const postId = btn.dataset.postId;
        const post = posts.find(p => p.id === postId);
        if (post && confirm(`Delete "${post.title}"? This cannot be undone.`)) {
          deletePost(postId);
        }
      });
    });
  }

  function showPostList() {
    document.getElementById('admin-post-list-view').style.display = '';
    document.getElementById('admin-editor-view').style.display = 'none';
    editingPostId = null;
    loadAdminPosts();
  }

  function showEditor(post) {
    editingPostId = post ? post.id : null;

    const editorTitle = document.getElementById('admin-editor-title');
    if (editorTitle) editorTitle.textContent = post ? 'Edit Post' : 'New Post';

    // Populate form
    document.getElementById('admin-post-id').value = post ? post.id : '';
    document.getElementById('admin-post-title').value = post ? post.title : '';
    document.getElementById('admin-post-excerpt').value = post ? post.excerpt || '' : '';
    document.getElementById('admin-post-content').value = post ? post.content || '' : '';
    document.getElementById('admin-post-status').value = post ? post.status : 'draft';
    document.getElementById('admin-post-category').value = post ? post.category : 'market-update';
    document.getElementById('admin-post-image').value = post ? post.image || '' : '';

    // Image preview
    const previewEl = document.getElementById('admin-image-preview');
    const previewImg = document.getElementById('admin-preview-img');
    const uploadZone = document.getElementById('admin-upload-zone');

    if (post && post.image) {
      previewImg.src = post.image;
      previewEl.style.display = '';
      uploadZone.style.display = 'none';
    } else {
      previewEl.style.display = 'none';
      uploadZone.style.display = '';
    }

    // Reset file input
    const imageInput = document.getElementById('admin-image-input');
    if (imageInput) imageInput.value = '';

    // Listing section
    const listingSection = document.getElementById('admin-listing-section');
    const isListing = post && post.category === 'listing';
    if (listingSection) listingSection.style.display = isListing ? '' : 'none';

    if (post && post.listing) {
      document.getElementById('admin-listing-price').value = post.listing.price || '';
      document.getElementById('admin-listing-status').value = post.listing.status || 'Active';
      document.getElementById('admin-listing-address').value = post.listing.address || '';
      document.getElementById('admin-listing-beds').value = post.listing.beds || '';
      document.getElementById('admin-listing-baths').value = post.listing.baths || '';
      document.getElementById('admin-listing-sqft').value = post.listing.sqft || '';
      document.getElementById('admin-listing-mls').value = post.listing.mlsNumber || '';
    } else {
      ['admin-listing-price', 'admin-listing-address', 'admin-listing-beds',
       'admin-listing-baths', 'admin-listing-sqft', 'admin-listing-mls'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      const lsEl = document.getElementById('admin-listing-status');
      if (lsEl) lsEl.value = 'Active';
    }

    // Clear messages
    hideFormMessages();

    document.getElementById('admin-post-list-view').style.display = 'none';
    document.getElementById('admin-editor-view').style.display = '';
    window.scrollTo(0, 0);
  }

  function hideFormMessages() {
    const errEl = document.getElementById('admin-save-error');
    const successEl = document.getElementById('admin-save-success');
    if (errEl) errEl.style.display = 'none';
    if (successEl) successEl.style.display = 'none';
  }

  async function savePost() {
    const title = document.getElementById('admin-post-title').value.trim();
    if (!title) {
      showFormError('Title is required.');
      return;
    }

    const category = document.getElementById('admin-post-category').value;
    const saveBtn = document.getElementById('admin-save-btn');
    const origText = saveBtn.textContent;
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;
    hideFormMessages();

    const body = {
      title,
      category,
      excerpt: document.getElementById('admin-post-excerpt').value.trim(),
      content: document.getElementById('admin-post-content').value.trim(),
      status: document.getElementById('admin-post-status').value,
      image: document.getElementById('admin-post-image').value
    };

    if (category === 'listing') {
      body.listing = {
        price: document.getElementById('admin-listing-price').value.trim(),
        status: document.getElementById('admin-listing-status').value,
        address: document.getElementById('admin-listing-address').value.trim(),
        beds: parseInt(document.getElementById('admin-listing-beds').value) || null,
        baths: parseFloat(document.getElementById('admin-listing-baths').value) || null,
        sqft: document.getElementById('admin-listing-sqft').value.trim(),
        mlsNumber: document.getElementById('admin-listing-mls').value.trim()
      };
    }

    try {
      const isEdit = !!editingPostId;
      const url = isEdit ? `/api/posts/${editingPostId}` : '/api/posts';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save post');
      }

      const savedPost = await res.json();
      editingPostId = savedPost.id;

      showFormSuccess(isEdit ? 'Post updated!' : 'Post created!');

      // Invalidate blog cache so next visit reloads
      blogPostsCache = null;

      // Return to list after a moment
      setTimeout(() => showPostList(), 1200);

    } catch (err) {
      showFormError(err.message || 'Error saving post. Please try again.');
    } finally {
      saveBtn.textContent = origText;
      saveBtn.disabled = false;
    }
  }

  async function deletePost(postId) {
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Key': adminKey }
      });
      if (!res.ok) throw new Error('Delete failed');
      // Invalidate blog cache
      blogPostsCache = null;
      loadAdminPosts();
    } catch (err) {
      alert('Failed to delete post. Please try again.');
    }
  }

  async function handleImageUpload(file) {
    const uploadZone = document.getElementById('admin-upload-zone');
    const origContent = uploadZone.innerHTML;

    uploadZone.classList.add('uploading');
    uploadZone.innerHTML = `
      <div class="blog-loading-spinner" style="width:28px;height:28px;margin:0 auto;"></div>
      <p style="margin-top:var(--space-2);">Uploading&hellip;</p>`;

    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'X-Admin-Key': adminKey },
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
      }

      const { url } = await res.json();
      document.getElementById('admin-post-image').value = url;

      const previewImg = document.getElementById('admin-preview-img');
      const previewEl = document.getElementById('admin-image-preview');
      previewImg.src = url;
      previewEl.style.display = '';
      uploadZone.style.display = 'none';

    } catch (err) {
      alert('Image upload failed: ' + (err.message || 'Unknown error'));
      uploadZone.innerHTML = origContent;
      uploadZone.classList.remove('uploading');

      // Re-bind click for file input after replacing innerHTML
      const imageInput = document.getElementById('admin-image-input');
      if (imageInput) {
        uploadZone.addEventListener('click', () => imageInput.click(), { once: true });
      }
    } finally {
      uploadZone.classList.remove('uploading');
    }
  }

  function showFormError(msg) {
    const errEl = document.getElementById('admin-save-error');
    if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
    const successEl = document.getElementById('admin-save-success');
    if (successEl) successEl.style.display = 'none';
  }

  function showFormSuccess(msg) {
    const successEl = document.getElementById('admin-save-success');
    if (successEl) { successEl.textContent = msg; successEl.style.display = 'block'; }
    const errEl = document.getElementById('admin-save-error');
    if (errEl) errEl.style.display = 'none';
  }


  /* ========================================
     HELPERS
     ======================================== */

  function escHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(isoString) {
    if (!isoString) return '';
    try {
      return new Date(isoString).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
    } catch (e) {
      return isoString;
    }
  }

  function categoryName(cat) {
    const map = {
      'listing': 'New Listing',
      'market-update': 'Market Update',
      'buyer-tips': 'Buyer Tips',
      'seller-tips': 'Seller Tips',
      'community': 'Community Spotlight'
    };
    return map[cat] || cat || 'General';
  }

})();
