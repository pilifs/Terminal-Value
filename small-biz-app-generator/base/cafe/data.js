// data.js
const mockDB = {
  companyInfo: {
    name: 'Context Cafe',
    tagline: 'Brewed by Logic, Sipped by Humans.',
    aboutText:
      'Founded in 2024, Context Cafe is an experiment in generative gastronomy. We believe that coffee tastes better when the code behind it is clean.',
    contact: {
      address: '123 Algorithm Ave, Tech City',
      email: 'hello@contextcafe.local',
      phone: '(555) 010-1100',
    },
  },
  specials: [
    {
      id: 1,
      name: 'Recursive Roast',
      price: 4.5,
      description: 'A coffee that tastes like itself.',
    },
    {
      id: 2,
      name: 'Binary Bagel',
      price: 3.0,
      description: 'On or off? Toasted or raw. No in-between.',
    },
  ],
  menu: {
    coffee: [
      { id: 101, name: 'Espresso', price: 2.5 },
      { id: 102, name: 'Latte', price: 4.0 },
      { id: 103, name: 'Cappuccino', price: 4.0 },
      { id: 104, name: 'Cold Brew', price: 4.5 },
    ],
    pastries: [
      { id: 201, name: 'Croissant', price: 3.5 },
      { id: 202, name: 'Blueberry Muffin', price: 3.0 },
      { id: 203, name: 'Scone', price: 3.25 },
    ],
  },
  events: [
    {
      id: 1,
      date: '2024-03-15',
      title: 'Live Jazz Night',
      description: 'Smooth jazz and smooth espresso.',
    },
    {
      id: 2,
      date: '2024-03-20',
      title: 'Developer Meetup',
      description: 'Bring your laptop, get free refills.',
    },
  ],
};
