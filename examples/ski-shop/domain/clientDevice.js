const AggregateRoot = require('../framework/aggregateRoot');
const { Events } = require('./constants/eventConstants');

class ClientDevice extends AggregateRoot {
  constructor(id, history) {
    super(id, history, {
      id: id,
      browser: null,
      viewportWidth: 0,
      deviceName: null,
      firstSeenAt: null,
    });
  }

  apply(event) {
    switch (event.type) {
      case Events.Device.DETECTED:
        this.browser = event.browser;
        this.viewportWidth = event.viewportWidth;
        this.deviceName = event.deviceName;
        this.firstSeenAt = event.timestamp;
        break;
      case 'VIEWPORT_UPDATED':
        this.viewportWidth = event.width;
        break;
    }
  }

  initialize(browser, width, name) {
    return {
      type: Events.Device.DETECTED,
      aggregateId: this.id,
      browser,
      viewportWidth: width,
      deviceName: name,
      timestamp: Date.now(),
    };
  }

  updateViewport(width) {
    return {
      type: 'VIEWPORT_UPDATED',
      aggregateId: this.id,
      width,
      timestamp: Date.now(),
    };
  }
}

module.exports = ClientDevice;
