const AggregateRoot = require('../framework/aggregateRoot');
const { Events } = require('./constants/eventConstants');

class Client extends AggregateRoot {
    constructor(id, history) {
        super(id, history, {
            id: id,
            age: null,
            city: null,
            deviceId: null, // Foreign key to ClientDevice aggregate
            isRegistered: false
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
        }
    }

    register(age, city) {
        if (this.isRegistered) throw new Error("Client already registered");
        return {
            type: Events.Client.REGISTERED,
            aggregateId: this.id,
            age,
            city,
            timestamp: Date.now()
        };
    }

    moveToNewCity(newCity) {
        return {
            type: Events.Client.MOVED,
            aggregateId: this.id,
            newCity,
            timestamp: Date.now()
        };
    }

    linkDevice(deviceId) {
        // We only store the ID, not the object, to keep aggregates decoupled
        return {
            type: Events.Client.DEVICE_LINKED,
            aggregateId: this.id,
            deviceId,
            timestamp: Date.now()
        };
    }
}

module.exports = Client;