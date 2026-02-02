const AggregateRoot = require('../framework/aggregateRoot');

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
            case 'CLIENT_REGISTERED':
                this.isRegistered = true;
                this.age = event.age;
                this.city = event.city;
                break;
            case 'CLIENT_MOVED':
                this.city = event.newCity;
                break;
            case 'DEVICE_LINKED':
                this.deviceId = event.deviceId;
                break;
        }
    }

    register(age, city) {
        if (this.isRegistered) throw new Error("Client already registered");
        return {
            type: 'CLIENT_REGISTERED',
            aggregateId: this.id,
            age,
            city,
            timestamp: Date.now()
        };
    }

    moveToNewCity(newCity) {
        return {
            type: 'CLIENT_MOVED',
            aggregateId: this.id,
            newCity,
            timestamp: Date.now()
        };
    }

    linkDevice(deviceId) {
        // We only store the ID, not the object, to keep aggregates decoupled
        return {
            type: 'DEVICE_LINKED',
            aggregateId: this.id,
            deviceId,
            timestamp: Date.now()
        };
    }
}

module.exports = Client;