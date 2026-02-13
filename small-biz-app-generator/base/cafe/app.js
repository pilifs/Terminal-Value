// app.js

const app = document.getElementById('app');

// --- Render Functions ---

function renderSpecials() {
  const itemsHtml = mockDB.specials
    .map(
      (item) => `
        <div class="card special-card">
            <h3>${item.name}</h3>
            <p>${item.description}</p>
            <span class="price">$${item.price.toFixed(2)}</span>
        </div>
    `
    )
    .join('');

  app.innerHTML = `
        <section>
            <h1>Today's Specials</h1>
            <div class="grid">${itemsHtml}</div>
        </section>
    `;
}

function renderMenu() {
  // Helper to render a category
  const renderCategory = (title, items) => `
        <div class="menu-category">
            <h2>${title}</h2>
            <ul>
                ${items
                  .map(
                    (item) => `
                    <li>
                        <span>${item.name}</span>
                        <span class="price-line"></span>
                        <span>$${item.price.toFixed(2)}</span>
                    </li>
                `
                  )
                  .join('')}
            </ul>
        </div>
    `;

  app.innerHTML = `
        <section>
            <h1>Full Menu</h1>
            <div class="menu-container">
                ${renderCategory('Coffee', mockDB.menu.coffee)}
                ${renderCategory('Pastries', mockDB.menu.pastries)}
            </div>
        </section>
    `;
}

function renderEvents() {
  const eventsHtml = mockDB.events
    .map(
      (evt) => `
        <div class="event-row">
            <div class="date-badge">${evt.date}</div>
            <div class="event-details">
                <h3>${evt.title}</h3>
                <p>${evt.description}</p>
            </div>
        </div>
    `
    )
    .join('');

  app.innerHTML = `
        <section>
            <h1>Upcoming Events</h1>
            <div class="events-list">${eventsHtml}</div>
        </section>
    `;
}

function renderAbout() {
  app.innerHTML = `
        <section class="text-center">
            <h1>About Us</h1>
            <p class="lead">${mockDB.companyInfo.tagline}</p>
            <hr>
            <p>${mockDB.companyInfo.aboutText}</p>
        </section>
    `;
}

function renderContact() {
  const { address, email, phone } = mockDB.companyInfo.contact;
  app.innerHTML = `
        <section class="text-center">
            <h1>Contact Us</h1>
            <div class="contact-box">
                <p><strong>📍 Address:</strong> ${address}</p>
                <p><strong>📧 Email:</strong> ${email}</p>
                <p><strong>📞 Phone:</strong> ${phone}</p>
            </div>
        </section>
    `;
}

// --- Router Logic ---

const routes = {
  specials: renderSpecials,
  menu: renderMenu,
  events: renderEvents,
  about: renderAbout,
  contact: renderContact,
};

function navigate(pageName) {
  const renderFn = routes[pageName];
  if (renderFn) {
    renderFn();
  } else {
    renderSpecials(); // Default
  }
}

// Event Delegation for Navigation
document.getElementById('nav-links').addEventListener('click', (e) => {
  if (e.target.tagName === 'A') {
    e.preventDefault();
    const page = e.target.getAttribute('data-page');
    navigate(page);
  }
});

// Initialize
navigate('specials');
