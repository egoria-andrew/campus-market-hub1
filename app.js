const API = '';
let products = [], category = 'All', cart = JSON.parse(localStorage.getItem('cmh_cart') || '[]');
let token = localStorage.getItem('cmh_token'), user = JSON.parse(localStorage.getItem('cmh_user') || 'null');
let authMode = 'login', lostFilter = 'All', communityLoaded = false;
const categories = ['All', 'Study', 'Electronics', 'Fashion'];

async function request(path, opts = {}) {
  const res = await fetch(API + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Session': token } : {}), ...(opts.headers || {}) } });
  const data = await res.json();
  if (!res.ok) throw Error(data.error || 'Something went wrong');
  return data;
}
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function load() {
  try { products = await request('/api/products'); renderProducts(); updateCart(); }
  catch { document.querySelector('#products').innerHTML = '<div class="empty">Marketplace could not load. Check that the demo server is running.</div>'; }
  await loadCommunity();
}
function renderProducts() {
  const q = (document.querySelector('#search')?.value || '').toLowerCase(), sort = document.querySelector('#sort')?.value || 'featured';
  const list = products.filter(p => (category === 'All' || p.category === category) && `${p.name} ${p.category} ${p.seller}`.toLowerCase().includes(q));
  if (sort === 'low') list.sort((a, b) => a.price - b.price); if (sort === 'high') list.sort((a, b) => b.price - a.price);
  document.querySelector('#filters').innerHTML = categories.map(x => `<button class="chip ${category === x ? 'active' : ''}" onclick="setCategory('${x}')">${x === 'All' ? 'Everything' : x}</button>`).join('');
  document.querySelector('#result-count').textContent = `Showing ${list.length} ${list.length === 1 ? 'find' : 'finds'} for campus`;
  document.querySelector('#products').innerHTML = list.length ? list.map(p => `<article class="product-card"><div class="product-art" onclick="detail(${p.id})"><span class="tag">${esc(p.category.toUpperCase())}</span><button class="heart" onclick="event.stopPropagation();this.classList.toggle('active')">♡</button>${p.image_url ? `<img class="product-photo" src="${esc(p.image_url)}" alt="${esc(p.name)}">` : `<span class="emoji">${esc(p.emoji)}</span>`}</div><div class="product-info"><div class="seller">${esc(p.seller)} · ${p.stock > 0 ? 'In stock' : 'Sold out'}</div><h3 onclick="detail(${p.id})" style="cursor:pointer">${esc(p.name)}</h3><div class="price-row"><div class="price">UGX ${Number(p.price).toLocaleString()} <small>/ item</small></div><button class="add-btn" onclick="add(${p.id})" ${p.stock < 1 ? 'disabled' : ''}>+</button></div></div></article>`).join('') : '<div class="empty">No finds match that search. Try another term.</div>';
}
function setCategory(x) { category = x; renderProducts(); }
function toggleFilters() { document.querySelector('#filters').classList.toggle('hidden'); }
function add(id) { const row = cart.find(x => x.id === id); if (row) row.quantity++; else cart.push({ id, quantity: 1 }); saveCart(); toast('Added to your bag'); }
function saveCart() { localStorage.setItem('cmh_cart', JSON.stringify(cart)); updateCart(); }
function updateCart() { const n = cart.reduce((a, x) => a + x.quantity, 0); document.querySelector('#cart-count').textContent = n; document.querySelector('#mobile-cart-count').textContent = n || ''; }
function showModal(html) { document.querySelector('#modal').innerHTML = html; document.querySelector('#overlay').classList.add('open'); }
function closeModal() { document.querySelector('#overlay').classList.remove('open'); }
function backdrop(e) { if (e.target.id === 'overlay') closeModal(); }
function toast(s) { const t = document.querySelector('#toast'); t.textContent = s; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2400); }

function accountAction() { if (!user) openAuth(); else if (user.role === 'vendor') vendorPanel(); else toast(`Signed in as ${user.name}`); }
function openAuth(mode = 'login') {
  authMode = mode; const reg = mode === 'register';
  showModal(`<button class="close" onclick="closeModal()">×</button><div class="eyebrow"><span></span> GULU UNIVERSITY</div><h2>${reg ? 'Join the campus community' : 'Welcome back'}</h2><p>${reg ? 'Create an account to shop, post or join in.' : 'Sign in to manage your campus marketplace activity.'}</p><form onsubmit="auth(event)">${reg ? '<label class="form-field"><span>Your name</span><input name="name" required placeholder="e.g. Amina Okello"></label>' : ''}<label class="form-field"><span>Email address</span><input name="email" required type="email" placeholder="you@example.com"></label><label class="form-field"><span>Password</span><input name="password" required type="password" placeholder="At least 6 characters"></label>${reg ? '<label class="form-field"><span>I want to</span><select name="role"><option value="student">Join as a student</option><option value="vendor">Sell as a vendor</option></select></label>' : ''}<button class="wide-btn">${reg ? 'Create account' : 'Sign in'}</button></form><div class="switch">${reg ? 'Already have an account?' : 'New to Campus Market Hub?'} <a onclick="openAuth('${reg ? 'login' : 'register'}')">${reg ? 'Sign in' : 'Create an account'}</a></div>${!reg ? '<p class="demo-credentials"><b>Demo:</b> vendor@campus.demo or student@campus.demo · password: campus123</p>' : ''}`);
}
async function auth(e) {
  e.preventDefault(); const data = Object.fromEntries(new FormData(e.target));
  try { const out = await request(authMode === 'register' ? '/api/register' : '/api/login', { method: 'POST', body: JSON.stringify(data) }); token = out.token; user = out.user; localStorage.setItem('cmh_token', token); localStorage.setItem('cmh_user', JSON.stringify(user)); updateAccount(); closeModal(); await loadCommunity(); toast(`Welcome, ${user.name.split(' ')[0]}`); if (user.role === 'vendor') vendorPanel(); }
  catch (err) { toast(err.message); }
}
function updateAccount() { document.querySelector('#account-btn').textContent = user ? user.name.split(' ')[0] : 'Sign in'; }
function detail(id) { const p = products.find(x => x.id === id); if (!p) return; showModal(`<button class="close" onclick="closeModal()">×</button><div class="detail-art">${p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}">` : esc(p.emoji)}</div><div class="eyebrow"><span></span> ${esc(p.category.toUpperCase())}</div><h2>${esc(p.name)}</h2><p>${esc(p.description)}</p><p><b>Seller:</b> ${esc(p.seller)}<br><b>Availability:</b> ${p.stock} in stock</p><div class="price detail-price">UGX ${Number(p.price).toLocaleString()}</div><button class="wide-btn" onclick="add(${p.id});closeModal()">Add to bag</button>`); }
function openCart() {
  const total = cart.reduce((sum, x) => sum + (products.find(p => p.id === x.id)?.price || 0) * x.quantity, 0);
  showModal(`<button class="close" onclick="closeModal()">×</button><h2>Your bag</h2><p>Good finds, almost yours.</p>${cart.length ? cart.map(x => { const p = products.find(y => y.id === x.id); return p ? `<div class="cart-row"><div>${esc(p.emoji)} &nbsp;${esc(p.name)}<small>UGX ${p.price.toLocaleString()} each</small></div><div class="quantity"><button onclick="changeQty(${p.id},-1)">−</button>${x.quantity}<button onclick="changeQty(${p.id},1)">+</button></div></div>` : ''; }).join('') : '<div class="empty">Your bag is waiting for a good find.</div>'}<div class="cart-row"><b>Estimated total</b><b>UGX ${total.toLocaleString()}</b></div>${cart.length ? '<button class="wide-btn" onclick="checkout()">Place demo order</button><p class="modal-note">Payment is simulated. Coordinate pickup and payment with your seller.</p>' : ''}`);
}
function changeQty(id, delta) { const x = cart.find(a => a.id === id); if (x) { x.quantity += delta; if (x.quantity < 1) cart = cart.filter(a => a.id !== id); } saveCart(); openCart(); }
async function checkout() { if (!user) { closeModal(); openAuth(); return; } try { const order = await request('/api/orders', { method: 'POST', body: JSON.stringify({ items: cart }) }); cart = []; saveCart(); closeModal(); await load(); toast(`Order #${order.id} received · UGX ${order.total.toLocaleString()}`); } catch (e) { toast(e.message); } }
async function showOrders() { if (!user) { openAuth(); return; } try { const orders = await request('/api/orders'); showModal(`<button class="close" onclick="closeModal()">×</button><h2>Your orders</h2><p>Recent marketplace orders.</p>${orders.length ? orders.map(o => `<div class="order-row"><span><b>Order #${o.id}</b><br><small>${esc(o.created_at)}</small></span><span>${esc(o.status)}<br><b>UGX ${o.total.toLocaleString()}</b></span></div>`).join('') : '<div class="empty">No orders yet. Explore the marketplace to get started.</div>'}`); } catch (e) { toast(e.message); } }

async function loadCommunity() {
  try { const [posts, events] = await Promise.all([request('/api/lost-found'), request('/api/events')]); communityLoaded = true; renderLost(posts); renderEvents(events); }
  catch { document.querySelector('#lost-list').innerHTML = '<div class="community-empty">Could not load posts. Check the server and refresh.</div>'; document.querySelector('#event-list').innerHTML = '<div class="community-empty">Could not load events. Check the server and refresh.</div>'; }
}
function setLostFilter(value, button) { lostFilter = value; document.querySelectorAll('#lost-tabs .community-chip').forEach(b => b.classList.remove('active')); button.classList.add('active'); loadCommunity(); }
function renderLost(posts) {
  const filtered = lostFilter === 'All' ? posts : posts.filter(p => p.kind === lostFilter);
  document.querySelector('#lost-list').innerHTML = filtered.length ? filtered.map(p => `<article class="lost-card"><div class="lost-card-top"><span class="post-badge ${p.kind.toLowerCase()}">${p.kind === 'Lost' ? 'Looking for' : 'Found'}</span><span class="post-date">${formatDate(p.created_at)}</span></div><h3>${esc(p.item_name)}</h3><p>${esc(p.description)}</p><div class="post-location"><span>⌖</span> ${esc(p.location)}</div><div class="lost-card-foot"><span>Shared by ${esc(p.reporter)}</span><a href="mailto:${encodeURIComponent(p.contact)}">Contact <b>↗</b></a></div></article>`).join('') : `<div class="community-empty"><span>🔎</span><b>No ${lostFilter === 'All' ? 'posts' : lostFilter.toLowerCase() + ' items'} yet</b><small>Be the first to share a campus notice.</small></div>`;
}
function openLostForm() {
  if (!user) { openAuth('login'); toast('Sign in to post to Lost & Found'); return; }
  showModal(`<button class="close" onclick="closeModal()">×</button><div class="eyebrow"><span></span> CAMPUS COMMUNITY</div><h2>Post to Lost &amp; Found</h2><p>Share enough detail to help someone recognise the item.</p><form onsubmit="submitLost(event)"><label class="form-field"><span>I'm reporting</span><select name="kind"><option>Lost</option><option>Found</option></select></label><label class="form-field"><span>Item</span><input name="item_name" required placeholder="e.g. Blue notebook"></label><label class="form-field"><span>Details</span><textarea name="description" required placeholder="Colour, brand or other helpful details"></textarea></label><label class="form-field"><span>Where was it lost or found?</span><input name="location" required placeholder="e.g. Main library"></label><label class="form-field"><span>Contact email</span><input name="contact" type="email" value="${esc(user.email)}" required></label><button class="wide-btn">Publish post</button></form>`);
}
async function submitLost(e) { e.preventDefault(); try { await request('/api/lost-found', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.target))) }); closeModal(); await loadCommunity(); toast('Your campus notice is posted'); } catch (err) { toast(err.message); } }
function openEventForm() {
  if (!user) { openAuth('login'); toast('Sign in to share a campus event'); return; }
  showModal(`<button class="close" onclick="closeModal()">×</button><div class="eyebrow"><span></span> CAMPUS COMMUNITY</div><h2>Share a campus event</h2><p>Let students know what's coming up.</p><form onsubmit="submitEvent(event)"><label class="form-field"><span>Event name</span><input name="title" required placeholder="e.g. Film night on the lawn"></label><label class="form-field"><span>About the event</span><textarea name="description" required></textarea></label><label class="form-field"><span>Location</span><input name="location" required placeholder="Venue or meeting point"></label><label class="form-field"><span>Date and time</span><input name="starts_at" type="datetime-local" required></label><label class="form-field"><span>Category</span><select name="category"><option>Community</option><option>Arts & Culture</option><option>Learning</option><option>Sports</option><option>Wellbeing</option></select></label><label class="form-field"><span>Event icon</span><input name="emoji" value="📅" maxlength="4"></label><button class="wide-btn">Publish event</button></form>`);
}
async function submitEvent(e) { e.preventDefault(); try { await request('/api/events', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.target))) }); closeModal(); await loadCommunity(); toast('Your event is on the campus calendar'); } catch (err) { toast(err.message); } }
function formatEventDate(value) { const d = new Date(value); return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(d); }
function formatEventTime(value) { const d = new Date(value); return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(d); }
function formatDate(value) { const d = new Date(value); return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(d); }
function renderEvents(events) {
  document.querySelector('#event-list').innerHTML = events.length ? events.map(e => `<article class="event-card"><div class="event-art"><span class="event-emoji">${esc(e.emoji)}</span><span class="event-category">${esc(e.category)}</span></div><div class="event-card-body"><div class="event-date">${esc(formatEventDate(e.starts_at))} <span>·</span> ${esc(formatEventTime(e.starts_at))}</div><h3>${esc(e.title)}</h3><p>${esc(e.description)}</p><div class="post-location"><span>⌖</span> ${esc(e.location)}</div><div class="event-card-foot"><span>${Number(e.rsvp_count)} going · Hosted by ${esc(e.host)}</span><button class="rsvp-btn ${e.attending ? 'going' : ''}" onclick="rsvp(${e.id})">${e.attending ? 'Going ✓' : 'I’m interested'}</button></div></div></article>`).join('') : '<div class="community-empty">No campus events listed yet.</div>';
}
async function rsvp(id) { if (!user) { openAuth('login'); toast('Sign in to RSVP'); return; } try { await request(`/api/events/${id}/rsvp`, { method: 'POST', body: '{}' }); await loadCommunity(); } catch (e) { toast(e.message); } }

async function vendorPanel() {
  if (!user || user.role !== 'vendor') { openAuth(); return; }
  showModal(`<button class="close" onclick="closeModal()">×</button><div class="eyebrow"><span></span> VENDOR STUDIO</div><h2>Manage listings</h2><p>Add products, choose photos and update the demo catalogue.</p><form onsubmit="addProduct(event)"><label class="form-field"><span>Product name</span><input name="name" required></label><label class="form-field"><span>Category</span><select name="category"><option>Study</option><option>Electronics</option><option>Fashion</option><option>Food</option></select></label><div class="form-pair"><label class="form-field"><span>Price (UGX)</span><input name="price" type="number" min="1" required></label><label class="form-field"><span>Stock</span><input name="stock" type="number" min="0" value="5"></label></div><label class="form-field"><span>Description</span><textarea name="description" required></textarea></label><label class="form-field"><span>Product photo (optional)</span><input name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><small class="upload-hint">JPG, PNG, WEBP or GIF · up to 5 MB</small></label><label class="form-field"><span>Emoji fallback</span><input name="emoji" value="✨" maxlength="4"></label><button class="wide-btn">Add listing</button></form><div class="vendor-list"><b>Demo catalogue · change any photo</b>${products.map(p => `<div class="manage-product"><span class="manage-thumb">${p.image_url ? `<img src="${esc(p.image_url)}" alt="">` : esc(p.emoji)}</span><span class="manage-name">${esc(p.name)}<small>UGX ${p.price.toLocaleString()} · ${p.stock} in stock</small></span><label class="photo-change" title="Choose a new photo">📷<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onchange="updatePhoto(${p.id},this)"></label><label class="stock-label">Stock <input type="number" min="0" value="${p.stock}" onchange="updateStock(${p.id},this.value)"></label></div>`).join('') || '<p>No listings yet.</p>'}</div>`);
}
function readFile(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(Error('Could not read that photo')); reader.readAsDataURL(file); }); }
async function uploadImage(file) { if (file.size > 5 * 1024 * 1024) throw Error('Photos must be smaller than 5 MB'); const result = await request('/api/upload-image', { method: 'POST', body: JSON.stringify({ image: await readFile(file) }) }); return result.image_url; }
async function addProduct(e) { e.preventDefault(); try { const data = Object.fromEntries(new FormData(e.target)); const photo = e.target.elements.image.files[0]; delete data.image; if (photo) data.image_url = await uploadImage(photo); await request('/api/products', { method: 'POST', body: JSON.stringify(data) }); products = await request('/api/products'); renderProducts(); toast('Listing added to the marketplace'); vendorPanel(); } catch (e) { toast(e.message); } }
async function updatePhoto(id, input) { const photo = input.files[0]; if (!photo) return; try { const image_url = await uploadImage(photo); await request(`/api/products/${id}`, { method: 'PATCH', body: JSON.stringify({ image_url }) }); products = await request('/api/products'); renderProducts(); vendorPanel(); toast('Product photo updated'); } catch (e) { toast(e.message); } }
async function updateStock(id, stock) { try { await request(`/api/products/${id}`, { method: 'PATCH', body: JSON.stringify({ stock }) }); products = await request('/api/products'); renderProducts(); toast('Stock updated'); } catch (e) { toast(e.message); } }

document.querySelector('#account-btn').onclick = accountAction;
document.querySelectorAll('.bottom-nav a').forEach(a => a.addEventListener('click', () => { document.querySelectorAll('.bottom-nav a').forEach(x => x.classList.remove('active')); a.classList.add('active'); }));
updateAccount(); load();
