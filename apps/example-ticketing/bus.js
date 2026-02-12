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
    // console.log(`[COMMAND] ${name}`, payload);
    return await this.routes[name](payload);
  }
}

class EventBus {
  constructor() {
    this.subscribers = {};
  }

  subscribe(eventName, handler) {
    if (!this.subscribers[eventName]) {
      this.subscribers[eventName] = [];
    }
    this.subscribers[eventName].push(handler);
  }

  async publish(eventName, payload) {
    // console.log(`[EVENT] ${eventName}`, payload);
    if (this.subscribers[eventName]) {
      // Execute all subscribers
      const promises = this.subscribers[eventName].map((handler) =>
        handler(payload)
      );
      await Promise.all(promises);
    }
  }
}

module.exports = {
  commandBus: new Bus(),
  queryBus: new Bus(),
  eventBus: new EventBus(),
};
