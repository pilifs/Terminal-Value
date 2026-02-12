// public/app.js
let CURRENT_USER_ID = null;
let CURRENT_SHOW_ID = null;
let CURRENT_CUSTOMER_ID = null;
let SELECTED_SEATS = []; // Objects: { id, price }
let CURRENT_SHOW_DATA = null;
let ALL_EVENTS_CACHE = [];

// --- Init ---
window.onload = async () => {
// 1. Check for Customer Context (White Label)
    const urlParams = new URLSearchParams(window.location.search);
    const custId = urlParams.get('customerId');
    
    if (custId) {
        CURRENT_CUSTOMER_ID = custId;
        // Fetch Customer Name for Branding
        const customer = await executeQuery('GetCustomer', { customerId: custId });
        if (customer) {
            document.getElementById('app-title').innerText = customer.name; // Update Header
            document.title = `${customer.name} | Tickets`; // Update Browser Tab
        }
    }

    // Check for persistance
    const storedUser = localStorage.getItem('jester_userId');
    const storedName = localStorage.getItem('jester_userName');
    
    if (storedUser && storedName) {
        CURRENT_USER_ID = storedUser;
        initApp(storedName);
    }

    // Init Search Listener
    const searchInput = document.getElementById('global-search');
    searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
    
    // Close search when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            document.getElementById('search-results').style.display = 'none';
        }
    });
};

// --- API Helpers ---
async function executeQuery(name, payload = {}) {
    const res = await fetch(`/api/query/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    return await res.json();
}

async function executeCommand(name, payload = {}) {
    const res = await fetch(`/api/command/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.error) {
        alert("⚠️ " + data.error);
        return { success: false };
    }
    return data;
}

// --- Navigation ---
function navigateTo(viewId) {
    // Hide all
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    
    // Show Target
    document.getElementById(`view-${viewId}`).classList.add('active');
    
    // Highlight Nav
    const navItems = document.querySelectorAll('.nav-item');
    if (viewId === 'shows') navItems[0].classList.add('active');
    if (viewId === 'comedians') navItems[1].classList.add('active');
    if (viewId === 'profile') navItems[2].classList.add('active');
    if (viewId === 'cart') navItems[3].classList.add('active');

    // Data Loading
    if (viewId === 'shows') loadEvents();
    if (viewId === 'comedians') loadComedians();
    if (viewId === 'profile') loadProfile();
    if (viewId === 'cart') loadCart();
}

// --- Auth ---
async function login() {
    const name = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const res = await executeCommand('RegisterUser', { name, email });
    if (res.success) {
        CURRENT_USER_ID = res.userId;
        localStorage.setItem('jester_userId', res.userId);
        localStorage.setItem('jester_userName', name);
        initApp(name);
    }
}

function initApp(name) {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('main-interface').style.display = 'block';
    document.getElementById('main-nav').style.display = 'flex';
    document.getElementById('search-nav-container').style.display = 'block'; // Show Search
    document.getElementById('user-display').innerText = `Hello, ${name}`;
    
    // Pre-fetch for search
    loadEvents(null, true); 
    navigateTo('shows');
}

// --- Search Logic ---
function handleSearch(query) {
    const resultsContainer = document.getElementById('search-results');
    if (!query || query.length < 2) {
        resultsContainer.style.display = 'none';
        return;
    }

    const lowerQ = query.toLowerCase();
    const matches = ALL_EVENTS_CACHE.filter(e => 
        e.artist.toLowerCase().includes(lowerQ) ||
        e.description.toLowerCase().includes(lowerQ) ||
        e.venue.toLowerCase().includes(lowerQ)
    );

    if (matches.length === 0) {
        resultsContainer.innerHTML = '<div class="search-item" style="color:#777">No results found</div>';
    } else {
        resultsContainer.innerHTML = matches.map(e => `
            <div class="search-item" onclick="selectSearchResult('${e.id}')">
                <span class="search-highlight">${e.artist}</span>
                <span style="font-size:0.8em; color:#888">${e.venue} • ${new Date(e.date).toLocaleDateString()}</span>
            </div>
        `).join('');
    }
    resultsContainer.style.display = 'block';
}

function selectSearchResult(showId) {
    document.getElementById('search-results').style.display = 'none';
    document.getElementById('global-search').value = '';
    navigateTo('shows');
    loadSeatingChart(showId);
}

// --- Shows View ---
async function loadEvents(filterComedianId = null, background = false) {
    // Pass CURRENT_CUSTOMER_ID to the query
    let events = await executeQuery('GetEvents', { customerId: CURRENT_CUSTOMER_ID });
    ALL_EVENTS_CACHE = events; 

    if (background) return;

    if (filterComedianId) {
        events = events.filter(e => e.comedianId === filterComedianId);
        navigateTo('shows'); // Force switch back to shows tab
    }
    
    const container = document.getElementById('event-list');
    
    if (events.length === 0) {
        container.innerHTML = '<p>No shows found.</p>';
        return;
    }

    container.innerHTML = events.map(e => {
        const tagsHtml = e.tags.map(t => 
            `<span class="badge ${t.includes('FAST') ? 'badge-fire' : 'badge-info'}">${t}</span>`
        ).join('');

        return `
        <div class="card event-card" onclick="loadSeatingChart('${e.id}')">
            <div style="margin-bottom: 5px;">${tagsHtml}</div>
            <h3 style="margin: 0 0 5px 0;">${e.artist}</h3>
            <p style="color: #aaa; font-size: 0.9em; margin: 0 0 10px 0;">${e.description || ''}</p>
            <p style="margin: 0; color: #888">📍 ${e.venue}</p>
            <p style="margin: 0; color: #888">📅 ${new Date(e.date).toLocaleDateString()} @ ${new Date(e.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
            <div style="display:flex; justify-content:space-between; margin-top:10px; border-top: 1px solid #333; padding-top: 10px;">
                <span style="color:${e.available > 0 ? '#03dac6' : '#cf6679'}">${e.available} seats left</span>
                <strong style="color: var(--accent)">From $${e.basePrice}</strong>
            </div>
        </div>
    `}).join('');
}

// --- Comedians View ---
async function loadComedians() {
    const comedians = await executeQuery('GetComedians');
    const container = document.getElementById('comedian-list');
    
    container.innerHTML = comedians.map(c => `
        <div class="card comedian-card" onclick="loadEvents('${c.id}')">
            <img src="${c.image}" class="comedian-img" />
            <h3 style="margin:0 0 5px 0">${c.name}</h3>
            <p style="color:#aaa; font-size:0.8em; margin:0">${c.bio}</p>
            <button style="margin-top:10px; width:100%; background:#333; color:white;">View Shows</button>
        </div>
    `).join('');
}

// --- Seating Chart Logic ---
async function loadSeatingChart(showId) {
    CURRENT_SHOW_ID = showId;
    SELECTED_SEATS = [];
    
    const data = await executeQuery('GetShowDetails', { showId });
    CURRENT_SHOW_DATA = data; 
    
    updateSelectionUI();
    
    // UI Setup
    document.getElementById('welcome-msg').style.display = 'none';
    document.getElementById('seat-map-container').style.display = 'block';
    document.getElementById('map-title').innerText = data.artist;
    document.getElementById('map-venue').innerText = data.venueName;
    document.getElementById('drink-min-warning').style.display = data.drinkMinimum ? 'block' : 'none';

    // Render Grid
    const grid = document.getElementById('seat-grid');
    grid.style.gridTemplateColumns = `repeat(${data.cols}, 1fr)`;
    
    grid.innerHTML = data.grid.map(cell => {
        if (cell.type === 'GAP') {
            return `<div class="seat" style="visibility: hidden; background: none; border: none;"></div>`;
        }
        const seat = cell.data;
        let className = 'seat';
        if (seat.tier === 'VIP') className += ' vip';
        let onClick = `onclick="toggleSeat('${seat.id}', ${seat.price})"`;
        let title = `${seat.tier}: $${seat.price}`;
        let content = seat.number;
        
        if (seat.status === 'SOLD') {
            className += ' sold'; onClick = ''; title = 'Sold Out'; content = 'X';
        } else if (seat.status === 'HELD') {
            className += ' held'; onClick = ''; title = 'Held';
        }
        
        return `<div id="seat-${seat.id}" class="${className}" ${onClick} title="${title}">${content}</div>`;
    }).join('');
}

function toggleSeat(seatId, price) {
    const index = SELECTED_SEATS.findIndex(s => s.id === seatId);
    const element = document.getElementById(`seat-${seatId}`);

    if (index === -1) {
        SELECTED_SEATS.push({ id: seatId, price: price });
        element.classList.add('selected');
    } else {
        SELECTED_SEATS.splice(index, 1);
        element.classList.remove('selected');
    }
    updateSelectionUI();
}

function updateSelectionUI() {
    const btn = document.getElementById('btn-reserve-specific');
    const total = SELECTED_SEATS.reduce((sum, s) => sum + s.price, 0);
    
    document.getElementById('total-price-display').innerText = total;
    document.getElementById('selected-ids').innerText = SELECTED_SEATS.map(s => s.id).join(', ');
    
    btn.disabled = SELECTED_SEATS.length === 0;
    btn.innerText = SELECTED_SEATS.length > 0 ? `Add to Cart` : 'Select Seats';
}

async function reserveSelectedSeats() {
    const ids = SELECTED_SEATS.map(s => s.id);
    const res = await executeCommand('ReserveTickets', {
        userId: CURRENT_USER_ID,
        showId: CURRENT_SHOW_ID,
        seatIds: ids
    });

    if (res.success) {
        alert("Tickets added to cart! Check the Cart tab to checkout.");
        loadSeatingChart(CURRENT_SHOW_ID);
        navigateTo('cart');
    }
}

// --- Cart Logic ---
async function loadCart() {
    const tickets = await executeQuery('GetUserTickets', { userId: CURRENT_USER_ID });
    const cartItems = tickets.filter(t => t.status === 'RESERVED');
    const container = document.getElementById('cart-items');
    
    if (cartItems.length === 0) {
        container.innerHTML = '<p style="color:#777">Your cart is empty.</p>';
        document.getElementById('btn-checkout').disabled = true;
        document.getElementById('cart-total').innerText = '0';
        return;
    }

    let total = 0;
    container.innerHTML = cartItems.map(t => {
        total += t.total;
        return `
        <div class="ticket-item reserved">
            <div style="color: white; font-weight: bold;">${t.artist}</div>
            <div style="font-size: 0.85em; color: #aaa; margin: 4px 0;">${t.venue}</div>
            <div style="display: flex; justify-content: space-between; font-size: 0.8em; margin-top: 8px;">
                <span>Seats: ${t.seats}</span>
                <span style="color: #ffd700; font-weight: bold">$${t.total}</span>
            </div>
        </div>
    `}).join('');
    
    document.getElementById('cart-total').innerText = total;
    document.getElementById('btn-checkout').disabled = false;
    document.getElementById('btn-checkout').onclick = () => checkout(cartItems);
}

async function checkout(cartItems) {
    if(!confirm(`Charge $${document.getElementById('cart-total').innerText} to your card?`)) return;

    for (const item of cartItems) {
        await executeCommand('PurchaseTickets', { reservationId: item.id });
    }
    alert("Purchase Successful! View your tickets in Profile.");
    navigateTo('profile');
}

// --- Profile Logic ---
async function loadProfile() {
    const tickets = await executeQuery('GetUserTickets', { userId: CURRENT_USER_ID });
    const confirmed = tickets.filter(t => t.status === 'CONFIRMED');
    const now = new Date();
    
    const upcoming = confirmed.filter(t => new Date(t.date) >= now);
    const past = confirmed.filter(t => new Date(t.date) < now);
    
    renderTicketList(upcoming, 'profile-upcoming', false);
    renderTicketList(past, 'profile-past', true);
}

function renderTicketList(items, elementId, isPast) {
    const container = document.getElementById(elementId);
    if (items.length === 0) {
        container.innerHTML = `<p style="color:#555">No ${isPast ? 'past' : 'upcoming'} shows.</p>`;
        return;
    }
    container.innerHTML = items.map(t => {
        // Generate QR for upcoming valid tickets
        // Using a public API for QR generation
        const qrSection = !isPast ? `
            <div style="margin-top:10px; background: white; padding:5px; border-radius:4px; display: inline-block;">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${t.id}" alt="Ticket QR" style="display:block; width:80px; height:80px;" />
            </div>
        ` : '';

        return `
        <div class="ticket-item ${isPast ? 'past' : ''}" style="display:flex; justify-content:space-between; align-items:center;">
            <div>
                <div style="color: white; font-weight: bold;">${t.artist}</div>
                <div style="font-size: 0.85em; color: #aaa; margin: 4px 0;">${new Date(t.date).toLocaleString()}</div>
                <div style="font-size: 0.8em; margin-top: 8px;">
                    ${t.venue} | <span style="color:#03dac6">Seats: ${t.seats}</span>
                </div>
            </div>
            ${qrSection}
        </div>
    `}).join('');
}