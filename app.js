// ─────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────

const CATS = [
  { id: 'produce',      label: 'Produce',      color: '#4caf50' },
  { id: 'cheese',       label: 'Cheese',        color: '#ffc107' },
  { id: 'dairy',        label: 'Dairy',         color: '#2196f3' },
  { id: 'meat',         label: 'Meat',          color: '#f44336' },
  { id: 'refrigerated', label: 'Refrigerated',  color: '#00bcd4' },
  { id: 'bakery',       label: 'Bakery',        color: '#795548' },
  { id: 'frozen',       label: 'Frozen',        color: '#5c6bc0' },
  { id: 'dry_goods',    label: 'Dry Goods',     color: '#ff9800' },
  { id: 'baking',       label: 'Baking',        color: '#9c27b0' },
  { id: 'misc',         label: 'Misc',          color: '#9e9e9e' },
];

const UNITS = [
  'bag', 'bags', 'bottle', 'bottles', 'box',
  'bunch', 'bunches',
  'can', 'cans', 'clove', 'cloves', 'cup',
  'dozen',
  'gallon',
  'head',
  'item', 'items',
  'jar', 'jars',
  'lb', 'lbs', 'loaf',
  'oz',
  'package', 'pint',
  'quart',
  'roll',
  'slice', 'slices', 'stalk', 'stalks',
  'tbsp', 'tsp',
];

const CAT_MAP = Object.fromEntries(CATS.map(c => [c.id, c]));

// Map old category IDs to new ones so saved data migrates cleanly
const CAT_MIGRATION = {
  pantry:      'dry_goods',
  herbs:       'produce',
  condiments:  'misc',
  beverages:   'misc',
  other:       'misc',
};

const ICON = {
  cart: `<svg viewBox="0 0 22 22" fill="none">
    <path d="M3 3h2l1 9h10l2-7H6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="9" cy="18" r="1.5" fill="currentColor"/>
    <circle cx="15" cy="18" r="1.5" fill="currentColor"/>
  </svg>`,
  list: `<svg viewBox="0 0 22 22" fill="none">
    <rect x="2" y="5"  width="18" height="2" rx="1" fill="currentColor"/>
    <rect x="2" y="10" width="18" height="2" rx="1" fill="currentColor"/>
    <rect x="2" y="15" width="18" height="2" rx="1" fill="currentColor"/>
  </svg>`,
  search: `<svg viewBox="0 0 20 20" fill="none" width="18" height="18">
    <circle cx="9" cy="9" r="6" stroke="currentColor" stroke-width="2"/>
    <line x1="13.5" y1="13.5" x2="17" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
};


// ─────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────

let S = {
  view:        'list',
  meals:       [],
  list:        [],
  mealSearch:  '',
  preCheck:    { visible: false, mealId: null, checked: [] },
  form:        { visible: false, editId: null, ingredients: [] },
  detail:      { visible: false, mealId: null },
};

// ─────────────────────────────────────────────────
// STORAGE  (localStorage, with category migration)
// ─────────────────────────────────────────────────

function migrateCategory(cat) {
  return CAT_MIGRATION[cat] || cat;
}

function migrateMeals(meals) {
  return meals.map(m => ({
    ...m,
    ingredients: m.ingredients.map(i => ({ ...i, category: migrateCategory(i.category) })),
  }));
}

function migrateList(list) {
  return list.map(i => ({ ...i, category: migrateCategory(i.category) }));
}

function save() {
  try {
    localStorage.setItem('gl_meals', JSON.stringify(S.meals));
  } catch(e) {}
}

async function load() {
  // Always fetch data.json first — meals are the source of truth from the repo
  // The list is never persisted to data.json; it always starts empty
  try {
    const res = await fetch('./data.json');
    if (res.ok) {
      const data = await res.json();
      S.meals = migrateMeals(data.meals || []);
      S.list  = [];
      localStorage.setItem('gl_meals', JSON.stringify(S.meals));
      localStorage.removeItem('gl_list');
      render();
      return;
    }
  } catch(e) {}

  // Offline or fetch failed — fall back to localStorage for meals only
  try {
    const lm = localStorage.getItem('gl_meals');
    S.meals = lm ? migrateMeals(JSON.parse(lm)) : [];
    S.list  = [];
  } catch(e) {
    S.meals = [];
    S.list  = [];
  }
  render();
}

// ─────────────────────────────────────────────────
// DOWNLOAD  — saves current app state as data.json
// ─────────────────────────────────────────────────

function downloadJSON() {
  const payload = {
    version:     1,
    lastUpdated: new Date().toISOString(),
    meals:       S.meals,
    list:        S.list,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'data.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('data.json downloaded — commit and push to update the repo');
}

// ─────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────

function uid() {
  return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function fmtPrice(n) {
  if (!n || n <= 0) return '';
  return '$' + Number(n).toFixed(2);
}

function totalList(items) {
  return items.reduce((a, i) => a + (i.price || 0), 0);
}

function catInfo(id) {
  return CAT_MAP[id] || CATS[CATS.length - 1];
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toast(msg, type = '') {
  const wrap = document.getElementById('toast-wrap');
  const el   = document.createElement('div');
  el.className   = 'toast ' + type;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.opacity    = '0';
    el.style.transition = 'opacity .3s';
    setTimeout(() => el.remove(), 300);
  }, 2400);
}

// ─────────────────────────────────────────────────
// RENDER — BOTTOM NAV
// ─────────────────────────────────────────────────

function renderNav() {
  const unchecked = S.list.filter(i => !i.checked).length;
  document.getElementById('bnav').innerHTML = `
    <button class="bnav-tab ${S.view === 'list' ? 'active' : ''}" onclick="setView('list')">
      ${ICON.cart}
      <span>My List</span>
      ${unchecked > 0 ? `<span class="bnav-badge">${unchecked}</span>` : ''}
    </button>
    <button class="bnav-tab ${S.view === 'meals' ? 'active' : ''}" onclick="setView('meals')">
      ${ICON.list}
      <span>Meals</span>
    </button>`;
}

// ─────────────────────────────────────────────────
// RENDER — LIST VIEW
// ─────────────────────────────────────────────────

function renderListView() {
  const remaining = S.list.filter(i => !i.checked).length;
  const checked   = S.list.filter(i =>  i.checked).length;

  document.getElementById('hdr-mount').innerHTML = `
    <header class="hdr">
      <div style="flex:1">
        <div class="hdr-title">Grocery List</div>
        ${S.list.length > 0 ? `<div class="hdr-sub">${remaining} item${remaining !== 1 ? 's' : ''} remaining</div>` : ''}
      </div>
      ${S.list.length > 0 ? `<button class="hdr-btn" onclick="exportList()">Export</button>` : ''}
    </header>`;

  if (!S.list.length) {
    document.getElementById('main').innerHTML = `
      <div class="empty">
        <div class="empty-icon">${ICON.cart}</div>
        <div class="empty-title">Your list is empty</div>
        <div class="empty-sub">Go to Meals to add ingredients, or tap + to add items manually.</div>
      </div>`;
    document.getElementById('fab-mount').innerHTML = `<button class="fab" onclick="openAddManual()">+</button>`;
    return;
  }

  // Group items by category
  const groups = {};
  for (const item of S.list) {
    if (!groups[item.category]) groups[item.category] = [];
    groups[item.category].push(item);
  }
  const orderedCats      = CATS.map(c => c.id).filter(id => groups[id]);
  const totalUnchecked   = totalList(S.list.filter(i => !i.checked));
  const totalAll         = totalList(S.list);

  let html = '';

  // Summary bar
  if (totalAll > 0) {
    html += `
      <div class="summary-bar">
        <div class="total-col">
          <div class="total-label">Estimated Total</div>
          <div class="total-amount">$${totalUnchecked.toFixed(2)}</div>
          <div class="total-note">Whole Foods estimate &middot; ${remaining} item${remaining !== 1 ? 's' : ''}</div>
        </div>
        <div class="summary-actions">
          ${checked > 0 ? `<button class="btn btn-ghost btn-sm" onclick="clearChecked()">Clear ${checked} checked</button>` : ''}
        </div>
      </div>`;
  }

  if (S.list.length > 1) {
    html += `
      <div class="action-row">
        <button class="link-btn" onclick="checkAllItems()">Select all</button>
        ${checked > 0 ? `<button class="link-btn red" onclick="clearChecked()">Remove checked (${checked})</button>` : ''}
      </div>`;
  }

  for (const catId of orderedCats) {
    const cat      = catInfo(catId);
    const items    = groups[catId];
    const catTotal = totalList(items);
    html += `
      <div class="section">
        <div class="section-hdr">
          <div class="cat-dot" style="background:${cat.color}"></div>
          <span class="section-title">${cat.label}</span>
          <span class="section-count">${items.length}</span>
          ${catTotal > 0 ? `<span class="section-total">$${catTotal.toFixed(2)}</span>` : ''}
        </div>`;
    for (const item of items) {
      const qd = [item.qty, item.unit].filter(Boolean).join(' ');
      html += `
        <div class="list-item ${item.checked ? 'done' : ''}">
          <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="toggleItem('${item.id}')">
          <div class="item-info">
            <div class="item-name">${esc(item.name)}</div>
            ${qd ? `<div class="item-meta">${esc(qd)}</div>` : ''}
            ${item.source ? `<span class="item-source">${esc(item.source)}</span>` : ''}
          </div>
          <div class="item-right">
            ${item.price > 0 ? `<span class="item-price">${fmtPrice(item.price)}</span>` : ''}
            <button class="item-del" onclick="removeItem('${item.id}')">&#x2715;</button>
          </div>
        </div>`;
    }
    html += `</div>`;
  }

  html += `<div style="height:16px"></div>`;
  document.getElementById('main').innerHTML      = html;
  document.getElementById('fab-mount').innerHTML = `<button class="fab" onclick="openAddManual()">+</button>`;
}

// ─────────────────────────────────────────────────
// RENDER — MEALS VIEW
// ─────────────────────────────────────────────────

function renderMealsView() {
  document.getElementById('hdr-mount').innerHTML = `
    <header class="hdr">
      <div class="hdr-title">Meals</div>
      <button class="hdr-btn" onclick="downloadJSON()">Save</button>
      <button class="hdr-btn" onclick="openForm(null)">+ New Meal</button>
    </header>`;

  const query    = S.mealSearch.toLowerCase().trim();
  const filtered = query
    ? S.meals.filter(m =>
        m.name.toLowerCase().includes(query) ||
        (m.description || '').toLowerCase().includes(query) ||
        m.ingredients.some(i => i.name.toLowerCase().includes(query)))
    : S.meals;

  let html = `
    <div class="search-wrap">
      <div class="search-box">
        <span class="search-icon">${ICON.search}</span>
        <input class="search" id="meal-search" type="text"
          placeholder="Search meals or ingredients..."
          value="${esc(S.mealSearch)}"
          oninput="onSearchInput(this.value)">
        ${S.mealSearch ? `<button class="search-clear" onclick="clearSearch()">&#x2715;</button>` : ''}
      </div>
    </div>
    <div style="padding:8px 12px 4px;font-size:.78rem;color:var(--txt2)">
      ${filtered.length} meal${filtered.length !== 1 ? 's' : ''}
    </div>`;

  if (!filtered.length) {
    html += `
      <div class="empty" style="padding:40px 32px">
        <div class="empty-title">${query ? 'No meals found' : 'No meals yet'}</div>
        <div class="empty-sub">${query ? 'Try a different search term.' : 'Tap "+ New Meal" to add your first recipe.'}</div>
      </div>`;
  } else {
    for (const meal of filtered) {
      const totalCost = meal.ingredients.reduce((a, i) => a + (i.price || 0), 0);
      html += `
        <div class="meal-card">
          <div style="display:flex;align-items:flex-start;gap:8px">
            <div style="flex:1">
              <div class="meal-name">${esc(meal.name)}</div>
              ${meal.description ? `<div class="meal-desc">${esc(meal.description)}</div>` : ''}
            </div>
            <div style="display:flex;gap:4px;flex-shrink:0">
              <button class="btn btn-ghost btn-sm" onclick="openForm('${meal.id}')">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="deleteMeal('${meal.id}')">Delete</button>
            </div>
          </div>
          <div class="meal-pills">
            <span class="pill">${meal.ingredients.length} ingredients</span>
            ${totalCost > 0 ? `<span class="pill">~$${totalCost.toFixed(2)}</span>` : ''}
          </div>
          <div class="meal-actions">
            <button class="btn btn-primary btn-sm" onclick="openPreCheck('${meal.id}')">+ Add to List</button>
            <button class="btn btn-ghost btn-sm" onclick="openDetail('${meal.id}')">View Recipe</button>
          </div>
        </div>`;
    }
  }

  html += `<div style="height:24px"></div>`;
  document.getElementById('main').innerHTML      = html;
  document.getElementById('fab-mount').innerHTML = `<button class="fab" onclick="openForm(null)">+</button>`;

  setTimeout(() => {
    const el = document.getElementById('meal-search');
    if (el && S.mealSearch) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  }, 0);
}

// ─────────────────────────────────────────────────
// RENDER — PRE-CHECK MODAL
// ─────────────────────────────────────────────────

function renderPreCheck() {
  if (!S.preCheck.visible) { document.getElementById('modal-mount').innerHTML = ''; return; }
  const meal = S.meals.find(m => m.id === S.preCheck.mealId);
  if (!meal) { closePreCheck(); return; }

  const ch          = S.preCheck.checked;
  const selectedCnt = ch.filter(Boolean).length;
  const selectedCost = meal.ingredients.reduce((a, i, idx) => a + (ch[idx] ? (i.price || 0) : 0), 0);

  let rows = '';
  meal.ingredients.forEach((ing, idx) => {
    const c   = ch[idx];
    const cat = catInfo(ing.category);
    rows += `
      <div class="check-item ${c ? '' : 'unchecked'}">
        <input type="checkbox" ${c ? 'checked' : ''} onchange="togglePreCheck(${idx})">
        <div class="check-info">
          <div class="check-name">${esc(ing.name)}</div>
          <div class="check-qty">${esc(ing.qty)} ${esc(ing.unit)} &middot; ${cat.label}</div>
        </div>
        ${ing.price > 0 ? `<span class="check-price">${fmtPrice(ing.price)}</span>` : ''}
      </div>`;
  });

  document.getElementById('modal-mount').innerHTML = `
    <div class="modal-overlay" onclick="overlayClose(event)">
      <div class="modal-sheet" onclick="event.stopPropagation()">
        <div class="modal-handle"></div>
        <div class="modal-hdr">
          <div>
            <div class="modal-title">${esc(meal.name)}</div>
            <div class="modal-sub">Uncheck items you already have</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="toggleAllPreCheck()">
            ${selectedCnt === meal.ingredients.length ? 'Uncheck All' : 'Check All'}
          </button>
        </div>
        <div class="modal-body">${rows}</div>
        <div class="modal-footer">
          <button class="btn btn-ghost" style="flex:1" onclick="closePreCheck()">Cancel</button>
          <button class="btn btn-primary" style="flex:2" onclick="addToList()"
            ${selectedCnt === 0 ? 'disabled style="opacity:.4"' : ''}>
            Add ${selectedCnt} item${selectedCnt !== 1 ? 's' : ''}
            ${selectedCost > 0 ? `(~$${selectedCost.toFixed(2)})` : ''}
          </button>
        </div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────
// RENDER — DETAIL MODAL
// ─────────────────────────────────────────────────

function renderDetail() {
  if (!S.detail.visible) { document.getElementById('modal-mount').innerHTML = ''; return; }
  const meal = S.meals.find(m => m.id === S.detail.mealId);
  if (!meal) { closeDetail(); return; }

  let rows = '';
  meal.ingredients.forEach(ing => {
    const cat = catInfo(ing.category);
    rows += `
      <div class="list-item" style="min-height:44px">
        <div class="cat-dot" style="background:${cat.color};width:8px;height:8px;flex-shrink:0"></div>
        <div class="item-info">
          <div class="item-name">${esc(ing.name)}</div>
          <div class="item-meta">${esc(ing.qty)} ${esc(ing.unit)} &middot; ${cat.label}</div>
        </div>
        ${ing.price > 0 ? `<span class="item-price">${fmtPrice(ing.price)}</span>` : ''}
      </div>`;
  });

  document.getElementById('modal-mount').innerHTML = `
    <div class="modal-overlay" onclick="overlayClose(event)">
      <div class="modal-sheet" onclick="event.stopPropagation()">
        <div class="modal-handle"></div>
        <div class="modal-hdr">
          <div style="flex:1">
            <div class="modal-title">${esc(meal.name)}</div>
            <div class="modal-sub">${meal.ingredients.length} ingredients</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="closeDetail(); openPreCheck('${meal.id}')">
            + Add to List
          </button>
        </div>
        <div class="modal-body">
          <div style="padding:10px 16px 4px">
            <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--txt2);margin-bottom:4px">
              Ingredients
            </div>
          </div>
          ${rows}
          ${meal.recipe ? `
            <div style="padding:12px 16px 4px;border-top:1px solid var(--border);margin-top:4px">
              <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--txt2);margin-bottom:8px">
                Recipe
              </div>
              <div style="font-size:.88rem;line-height:1.65;color:var(--txt);white-space:pre-wrap;padding-bottom:12px">
                ${esc(meal.recipe)}
              </div>
            </div>` : ''}
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" style="flex:1" onclick="closeDetail()">Close</button>
          <button class="btn btn-secondary" style="flex:1" onclick="closeDetail(); openForm('${meal.id}')">Edit</button>
        </div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────
// RENDER — MEAL FORM
// ─────────────────────────────────────────────────

function renderForm() {
  if (!S.form.visible) { document.getElementById('form-mount').innerHTML = ''; return; }
  const isEdit = !!S.form.editId;
  const meal   = isEdit ? S.meals.find(m => m.id === S.form.editId) : null;

  const catOptions  = CATS.map(c => `<option value="${c.id}">${c.label}</option>`).join('');
  const unitOptions = UNITS.map(u => `<option value="${u}">${u}</option>`).join('');

  let ingrRows = '';
  S.form.ingredients.forEach((ing, idx) => {
    ingrRows += `
      <div class="ingr-row" data-idx="${idx}">
        <input class="ingr-input" value="${esc(ing.name)}" placeholder="Name"
          oninput="formIngrChange(${idx}, 'name', this.value)">
        <input class="ingr-input" value="${esc(ing.qty)}" placeholder="Qty"
          oninput="formIngrChange(${idx}, 'qty', this.value)">
        <select class="ingr-input" onchange="formIngrChange(${idx}, 'unit', this.value)">
          ${UNITS.map(u => `<option value="${u}" ${ing.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
        </select>
        <select class="ingr-input" onchange="formIngrChange(${idx}, 'category', this.value)">
          ${CATS.map(c => `<option value="${c.id}" ${ing.category === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}
        </select>
        <input class="ingr-input" type="number" min="0" step="0.01"
          value="${ing.price || ''}" placeholder="$"
          oninput="formIngrChange(${idx}, 'price', this.value)"
          style="text-align:right">
        <button class="ingr-del" onclick="removeIngrRow(${idx})">&#x2715;</button>
      </div>`;
  });

  document.getElementById('form-mount').innerHTML = `
    <div class="form-overlay">
      <div class="form-hdr">
        <button class="hdr-icon-btn" onclick="closeForm()" style="font-size:1.3rem;font-weight:300">&#8249;</button>
        <span class="form-hdr-title">${isEdit ? 'Edit Meal' : 'New Meal'}</span>
        <button class="hdr-btn" onclick="saveMeal()">Save</button>
      </div>
      <div class="form-body">
        <div class="sec-label">Meal Details</div>
        <div class="field-group">
          <div class="field-row">
            <span class="field-label">Name</span>
            <input class="field-input" id="f-name" type="text"
              placeholder="e.g. Pasta Primavera" value="${esc(meal?.name || '')}">
          </div>
          <div class="field-row">
            <span class="field-label">Description</span>
            <input class="field-input" id="f-desc" type="text"
              placeholder="Short description..." value="${esc(meal?.description || '')}">
          </div>
        </div>

        <div class="sec-label">Ingredients</div>
        <div class="ingr-wrap">
          <div class="ingr-grid-hdr">
            <span class="ingr-col-hdr">Name</span>
            <span class="ingr-col-hdr">Qty</span>
            <span class="ingr-col-hdr">Unit</span>
            <span class="ingr-col-hdr">Category</span>
            <span class="ingr-col-hdr">Price</span>
            <span></span>
          </div>
          <div id="ingr-rows">${ingrRows}</div>
          <div class="ingr-add-row">
            <button class="btn btn-secondary btn-sm" onclick="addIngrRow()">+ Add Ingredient</button>
          </div>
        </div>

        <div class="sec-label">Recipe / Instructions</div>
        <div class="field-group">
          <textarea class="field-textarea" id="f-recipe"
            placeholder="Write your recipe steps here..." rows="6">${esc(meal?.recipe || '')}</textarea>
        </div>

        <div style="display:flex;gap:10px;margin-top:4px">
          <button class="btn btn-primary" style="flex:1" onclick="saveMeal()">Save Meal</button>
          ${isEdit ? `<button class="btn btn-danger" onclick="deleteMealFromForm()">Delete</button>` : ''}
        </div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────
// RENDER — MANUAL ADD MODAL
// ─────────────────────────────────────────────────

function renderManualAdd() {
  const catOptions  = CATS.map(c => `<option value="${c.id}">${c.label}</option>`).join('');
  const unitOptions = UNITS.map(u => `<option value="${u}">${u}</option>`).join('');
  document.getElementById('modal-mount').innerHTML = `
    <div class="modal-overlay" onclick="overlayClose(event)">
      <div class="modal-sheet" onclick="event.stopPropagation()" style="max-height:72vh">
        <div class="modal-handle"></div>
        <div class="modal-hdr">
          <div class="modal-title">Add Item</div>
        </div>
        <div class="modal-body" style="padding:16px">
          <div class="field-group" style="margin:0">
            <div class="field-row">
              <span class="field-label">Item</span>
              <input class="field-input" id="m-name" type="text" placeholder="e.g. Almond Milk">
            </div>
            <div class="field-row">
              <span class="field-label">Qty</span>
              <input class="field-input" id="m-qty" type="text" placeholder="1">
            </div>
            <div class="field-row">
              <span class="field-label">Unit</span>
              <select class="field-input" id="m-unit">${unitOptions}</select>
            </div>
            <div class="field-row">
              <span class="field-label">Category</span>
              <select class="field-input" id="m-cat">${catOptions}</select>
            </div>
            <div class="field-row">
              <span class="field-label">Est. Price</span>
              <input class="field-input" id="m-price" type="number" min="0" step="0.01" placeholder="0.00">
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" style="flex:1" onclick="closeModal()">Cancel</button>
          <button class="btn btn-primary" style="flex:2" onclick="saveManualItem()">Add to List</button>
        </div>
      </div>
    </div>`;
  setTimeout(() => document.getElementById('m-name')?.focus(), 100);
}

// ─────────────────────────────────────────────────
// MASTER RENDER
// ─────────────────────────────────────────────────

function render() {
  renderNav();
  if (S.view === 'list') renderListView();
  else                   renderMealsView();
  if (S.preCheck.visible) renderPreCheck();
  else if (S.detail.visible) renderDetail();
  renderForm();
}

// ─────────────────────────────────────────────────
// VIEW ACTIONS
// ─────────────────────────────────────────────────

function setView(v)          { S.view = v; render(); }
function onSearchInput(v)    { S.mealSearch = v; renderMealsView(); }
function clearSearch()       { S.mealSearch = ''; renderMealsView(); }

// ─────────────────────────────────────────────────
// LIST ACTIONS
// ─────────────────────────────────────────────────

function toggleItem(id) {
  const item = S.list.find(i => i.id === id);
  if (item) { item.checked = !item.checked; save(); render(); }
}

function removeItem(id) {
  S.list = S.list.filter(i => i.id !== id);
  save(); render();
}

function clearChecked() {
  S.list = S.list.filter(i => !i.checked);
  save(); render();
  toast('Checked items removed');
}

function checkAllItems() {
  const allChecked = S.list.every(i => i.checked);
  S.list.forEach(i => i.checked = !allChecked);
  save(); render();
}

function mergeOrAdd(newItem) {
  const existing = S.list.find(i =>
    !i.checked &&
    i.name.toLowerCase() === newItem.name.toLowerCase() &&
    i.unit === newItem.unit
  );
  if (existing) {
    const q1 = parseFloat(existing.qty), q2 = parseFloat(newItem.qty);
    if (!isNaN(q1) && !isNaN(q2)) {
      const sum = q1 + q2;
      existing.qty = Number.isInteger(sum) ? String(sum) : sum.toFixed(2).replace(/\.?0+$/, '');
    }
    existing.price = (existing.price || 0) + (newItem.price || 0);
    if (newItem.source && !existing.source.includes(newItem.source)) {
      existing.source += `, ${newItem.source}`;
    }
  } else {
    S.list.push(newItem);
  }
}

// ─────────────────────────────────────────────────
// PRE-CHECK MODAL ACTIONS
// ─────────────────────────────────────────────────

function openPreCheck(mealId) {
  const meal = S.meals.find(m => m.id === mealId);
  if (!meal) return;
  S.preCheck = { visible: true, mealId, checked: meal.ingredients.map(() => true) };
  S.detail.visible = false;
  renderPreCheck();
}

function closePreCheck() {
  S.preCheck.visible = false;
  document.getElementById('modal-mount').innerHTML = '';
}

function togglePreCheck(idx) {
  S.preCheck.checked[idx] = !S.preCheck.checked[idx];
  renderPreCheck();
}

function toggleAllPreCheck() {
  const allOn = S.preCheck.checked.every(Boolean);
  S.preCheck.checked = S.preCheck.checked.map(() => !allOn);
  renderPreCheck();
}

function addToList() {
  const meal = S.meals.find(m => m.id === S.preCheck.mealId);
  if (!meal) return;
  let count = 0;
  meal.ingredients.forEach((ing, idx) => {
    if (!S.preCheck.checked[idx]) return;
    mergeOrAdd({
      id:       uid(),
      name:     ing.name,
      qty:      ing.qty,
      unit:     ing.unit,
      category: ing.category || 'misc',
      price:    ing.price || 0,
      checked:  false,
      source:   meal.name,
    });
    count++;
  });
  closePreCheck();
  S.view = 'list';
  save(); render();
  toast(`Added ${count} item${count !== 1 ? 's' : ''} from ${meal.name}`);
}

// ─────────────────────────────────────────────────
// DETAIL MODAL ACTIONS
// ─────────────────────────────────────────────────

function openDetail(mealId) {
  S.detail = { visible: true, mealId };
  S.preCheck.visible = false;
  renderDetail();
}

function closeDetail() {
  S.detail.visible = false;
  document.getElementById('modal-mount').innerHTML = '';
}

function overlayClose(e) {
  if (e.target === e.currentTarget) {
    closePreCheck();
    closeDetail();
    document.getElementById('modal-mount').innerHTML = '';
  }
}

function closeModal() {
  document.getElementById('modal-mount').innerHTML = '';
}

// ─────────────────────────────────────────────────
// MANUAL ADD ITEM
// ─────────────────────────────────────────────────

function openAddManual() { renderManualAdd(); }

function saveManualItem() {
  const name = document.getElementById('m-name')?.value.trim();
  if (!name) { toast('Please enter an item name', 'error'); return; }
  mergeOrAdd({
    id:       uid(),
    name,
    qty:      document.getElementById('m-qty')?.value.trim() || '',
    unit:     document.getElementById('m-unit')?.value || 'item',
    category: document.getElementById('m-cat')?.value || 'misc',
    price:    parseFloat(document.getElementById('m-price')?.value) || 0,
    checked:  false,
    source:   '',
  });
  closeModal();
  S.view = 'list';
  save(); render();
  toast(`Added ${name}`);
}

// ─────────────────────────────────────────────────
// MEAL FORM ACTIONS
// ─────────────────────────────────────────────────

function openForm(mealId) {
  const meal = mealId ? S.meals.find(m => m.id === mealId) : null;
  S.form = {
    visible:     true,
    editId:      mealId || null,
    ingredients: meal
      ? JSON.parse(JSON.stringify(meal.ingredients))
      : [{ name: '', qty: '1', unit: 'item', category: 'produce', price: 0 }],
  };
  S.detail.visible = false;
  document.getElementById('modal-mount').innerHTML = '';
  renderForm();
  setTimeout(() => document.getElementById('f-name')?.focus(), 200);
}

function closeForm() {
  S.form.visible = false;
  document.getElementById('form-mount').innerHTML = '';
}

function formIngrChange(idx, field, val) {
  if (S.form.ingredients[idx]) {
    S.form.ingredients[idx][field] = field === 'price' ? (parseFloat(val) || 0) : val;
  }
}

function addIngrRow() {
  S.form.ingredients.push({ name: '', qty: '1', unit: 'item', category: 'produce', price: 0 });
  const container = document.getElementById('ingr-rows');
  if (!container) { renderForm(); return; }
  const idx = S.form.ingredients.length - 1;
  const div = document.createElement('div');
  div.className  = 'ingr-row';
  div.dataset.idx = idx;
  div.innerHTML = `
    <input class="ingr-input" value="" placeholder="Name"
      oninput="formIngrChange(${idx}, 'name', this.value)">
    <input class="ingr-input" value="1" placeholder="Qty"
      oninput="formIngrChange(${idx}, 'qty', this.value)">
    <select class="ingr-input" onchange="formIngrChange(${idx}, 'unit', this.value)">
      ${UNITS.map(u => `<option value="${u}" ${u === 'item' ? 'selected' : ''}>${u}</option>`).join('')}
    </select>
    <select class="ingr-input" onchange="formIngrChange(${idx}, 'category', this.value)">
      ${CATS.map(c => `<option value="${c.id}" ${c.id === 'produce' ? 'selected' : ''}>${c.label}</option>`).join('')}
    </select>
    <input class="ingr-input" type="number" min="0" step="0.01" value="" placeholder="$"
      oninput="formIngrChange(${idx}, 'price', this.value)" style="text-align:right">
    <button class="ingr-del" onclick="removeIngrRow(${idx})">&#x2715;</button>`;
  container.appendChild(div);
  div.querySelector('input').focus();
}

function removeIngrRow(idx) {
  if (S.form.ingredients.length <= 1) { toast('Need at least one ingredient'); return; }
  S.form.ingredients.splice(idx, 1);
  renderForm();
}

function saveMeal() {
  const name     = document.getElementById('f-name')?.value.trim();
  if (!name) { toast('Please enter a meal name', 'error'); return; }
  const desc     = document.getElementById('f-desc')?.value.trim()     || '';
  const recipe   = document.getElementById('f-recipe')?.value.trim()   || '';
  const valid    = S.form.ingredients.filter(i => i.name.trim());
  if (!valid.length) { toast('Add at least one ingredient', 'error'); return; }

  if (S.form.editId) {
    const meal = S.meals.find(m => m.id === S.form.editId);
    if (meal) Object.assign(meal, { name, description: desc, recipe, ingredients: valid });
  } else {
    S.meals.push({ id: uid(), name, description: desc, recipe, ingredients: valid });
  }

  closeForm();
  save(); render();
  toast(S.form.editId ? 'Meal updated' : 'Meal saved');
}

function deleteMeal(mealId) {
  if (!confirm('Delete this meal?')) return;
  S.meals = S.meals.filter(m => m.id !== mealId);
  save(); render();
  toast('Meal deleted');
}

function deleteMealFromForm() {
  if (!S.form.editId || !confirm('Delete this meal permanently?')) return;
  S.meals = S.meals.filter(m => m.id !== S.form.editId);
  closeForm();
  save(); render();
  toast('Meal deleted');
}

// ─────────────────────────────────────────────────
// EXPORT TO NOTES
// Format: "Item Name - qty unit  (~$price)"
// No date in title — Notes adds one automatically
// ─────────────────────────────────────────────────

function exportList() {
  const unchecked = S.list.filter(i => !i.checked);
  if (!unchecked.length) { toast('Nothing to export', 'error'); return; }

  const total = totalList(unchecked);

  const groups = {};
  for (const item of unchecked) {
    if (!groups[item.category]) groups[item.category] = [];
    groups[item.category].push(item);
  }

  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  let text = `${dateStr}\n` + '─'.repeat(28) + '\n\n';

  for (const catId of CATS.map(c => c.id).filter(id => groups[id])) {
    const cat = catInfo(catId);
    text += `${cat.label.toUpperCase()}\n`;
    for (const item of groups[catId]) {
      const qty   = [item.qty, item.unit].filter(Boolean).join(' ');
      const price = item.price > 0 ? `  (~${fmtPrice(item.price)})` : '';
      text += `${item.name}${qty ? ' - ' + qty : ''}${price}\n`;
    }
    text += '\n';
  }

  if (total > 0) {
    text += '─'.repeat(28) + '\n';
    text += `Estimated Total: ~$${total.toFixed(2)}\n`;
    text += `Whole Foods Market\n`;
  }

  if (navigator.share) {
    navigator.share({ title: 'Grocery List', text })
      .then(() => toast('List shared!'))
      .catch(err => { if (err.name !== 'AbortError') copyToClip(text); });
  } else {
    copyToClip(text);
  }
}

function copyToClip(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
      .then(() => toast('Copied — paste into Notes'))
      .catch(() => fbCopy(text));
  } else {
    fbCopy(text);
  }
}

function fbCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
  document.body.appendChild(ta);
  ta.focus(); ta.select();
  try { document.execCommand('copy'); toast('Copied — paste into Notes'); }
  catch(e) { toast('Could not copy', 'error'); }
  document.body.removeChild(ta);
}

// ─────────────────────────────────────────────────
// KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (S.form.visible)     { closeForm();     return; }
  if (S.preCheck.visible) { closePreCheck(); return; }
  if (S.detail.visible)   { closeDetail();   return; }
  const m = document.getElementById('modal-mount');
  if (m && m.innerHTML)   m.innerHTML = '';
});

// ─────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────

load();
