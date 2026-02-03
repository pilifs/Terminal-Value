const EventStore = require('./eventStore');
const Projector = require('../store/projections');

/**
 * APPLICATION SERVICE LAYER
 * Handles the "Load -> Execute -> Save" cycle for all aggregates.
 * Manages concurrency retries.
 */
async function dispatch(AggregateClass, aggregateId, actionCallback) {
    let retries = 3;
    while (retries > 0) {
        try {
            // 1. Rehydrate the Aggregate State
            const history = await EventStore.loadEvents(aggregateId);
            const aggregate = new AggregateClass(aggregateId, history);
            const expectedVersion = aggregate.version;

            // 2. Execute the Business Logic (Command)
            const event = actionCallback(aggregate);

            // 3. Persist the Resulting Event
            await EventStore.saveEvents(aggregateId, [event], expectedVersion);
            
            // 4. Update Read Models (Synchronous for this demo)
            Projector.handle(event);

            return { success: true, id: aggregateId, event };

        } catch (err) {
            if (err.message.includes('Concurrency Error')) {
                console.warn(`[Concurrency] Retrying command for ${aggregateId}...`);
                retries--;
            } else {
                throw err;
            }
        }
    }
    throw new Error("Transaction failed due to high contention.");
}

module.exports = { dispatch };