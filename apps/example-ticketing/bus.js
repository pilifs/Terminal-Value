// bus.js
class Bus {
  constructor() {
    this.routes = {};
  }

  register(name, handler) {
    this.routes[name] = handler;
  }

  async execute(name, payload) {
    if (!this.routes[name]) {
      throw new Error(`No handler registered for: ${name}`);
    }
    console.log(`[${name}] Processing...`, payload);
    return await this.routes[name](payload);
  }
}

module.exports = {
  commandBus: new Bus(),
  queryBus: new Bus(),
};
