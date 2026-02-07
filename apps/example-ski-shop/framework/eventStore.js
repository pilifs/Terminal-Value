class EventStore {
  constructor() {
    // In-memory storage for demo (Replace with Postgres/Mongo)
    this.store = new Map();
  }

  async loadEvents(aggregateId) {
    return this.store.get(aggregateId) || [];
  }

  async saveEvents(aggregateId, events, expectedVersion) {
    const currentEvents = this.store.get(aggregateId) || [];
    const currentVersion = currentEvents.length;

    // CONCURRENCY CHECK
    if (currentVersion !== expectedVersion) {
      throw new Error(
        `Concurrency Error: Expected version ${expectedVersion} but found ${currentVersion}`
      );
    }

    // Assign version numbers to new events
    let version = currentVersion;
    const eventsWithVersion = events.map((e) => ({
      ...e,
      version: ++version,
    }));

    this.store.set(aggregateId, [...currentEvents, ...eventsWithVersion]);

    return eventsWithVersion; // Return to publish to bus
  }
}

export default new EventStore();
