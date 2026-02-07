import AggregateRoot from '../framework/aggregateRoot.js';
import { Events } from './constants/eventConstants.js';

export default class Client extends AggregateRoot {
  constructor(id, history) {
    super(id, history, {
      id: id,
      age: null,
      city: null,
      deviceId: null,
      isRegistered: false,
      crmNotes: [],
    });
  }

  apply(event) {
    switch (event.type) {
      case Events.Client.REGISTERED:
        this.isRegistered = true;
        this.age = event.age;
        this.city = event.city;
        break;
      case Events.Client.MOVED:
        this.city = event.newCity;
        break;
      case Events.Client.DEVICE_LINKED:
        this.deviceId = event.deviceId;
        break;
      case Events.Client.NOTE_ADDED:
        this.crmNotes.push(event.note);
        break;
    }
  }

  register(age, city) {
    if (this.isRegistered) throw new Error('Client already registered');
    return {
      type: Events.Client.REGISTERED,
      aggregateId: this.id,
      age,
      city,
      timestamp: Date.now(),
    };
  }

  moveToNewCity(newCity) {
    return {
      type: Events.Client.MOVED,
      aggregateId: this.id,
      newCity,
      timestamp: Date.now(),
    };
  }

  linkDevice(deviceId) {
    return {
      type: Events.Client.DEVICE_LINKED,
      aggregateId: this.id,
      deviceId,
      timestamp: Date.now(),
    };
  }

  addCrmNote(note) {
    return {
      type: Events.Client.NOTE_ADDED,
      aggregateId: this.id,
      note,
      timestamp: Date.now(),
    };
  }
}
