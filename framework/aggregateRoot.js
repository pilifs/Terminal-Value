class AggregateRoot {
    constructor(id, history = [], initialState = {}) {
        this.id = id;
        this.version = 0;
        
        // Apply default state provided by the subclass
        Object.assign(this, initialState);

        // Automated Rehydration
        this.rehydrate(history);
    }

    /**
     * Infrastructure: Replays history to restore state
     */
    rehydrate(history) {
        history.forEach(event => this.applyChange(event, false));
    }

    /**
     * Infrastructure: Routes the event to the domain logic and updates version
     * @param {Object} event - The event object
     * @param {Boolean} isNew - True if this is a new command, False if replaying history
     */
    applyChange(event, isNew = true) {
        // Log to console for demo purposes with all properties of event
        console.log(`[Event Applied] Event:`, event);

        // 1. Delegate state mutation to the concrete child class
        this.apply(event);

        // 2. Update infrastructure state (versioning)
        // If we are replaying history, we accept the version from the event.
        // If it's a new event, the EventStore will assign the version later.
        if (!isNew) {
            this.version = event.version;
        }
    }

    /**
     * Abstract method: Must be implemented by the child
     */
    apply(event) {
        throw new Error("apply(event) method must be implemented by subclass");
    }
}

module.exports = AggregateRoot;