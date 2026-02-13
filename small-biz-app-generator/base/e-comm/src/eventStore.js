class EventStore {
  constructor() {
    this.events = [];
    this.subscribers = [];
  }

  /**
   * Publish an event to the store
   * @param {string} streamId - Unique ID of the aggregate (e.g., 'order_123')
   * @param {string} eventType - Type of event (e.g., 'ORDER_CREATED')
   * @param {object} payload - Data associated with the event
   */
  publish(streamId, eventType, payload) {
    const event = {
      id: this.events.length + 1,
      streamId,
      type: eventType,
      payload,
      timestamp: new Date(),
    };
    this.events.push(event);
    console.log(`[Event Store] New Event: ${eventType} for ${streamId}`);

    // Notify all subscribers (Projections)
    this.subscribers.forEach((sub) => sub(event));
    return event;
  }

  subscribe(callback) {
    this.subscribers.push(callback);
  }

  // Get all events for a specific entity to rebuild state
  getEventsForStream(streamId) {
    return this.events.filter((e) => e.streamId === streamId);
  }
}

module.exports = new EventStore();
