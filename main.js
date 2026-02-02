// main.js
const EventEmitter = require('events');
const BankAccount = require('./domain/bankAccount');
const EventStore = require('./framework/eventStore');
const Projector = require('./projections');

// 1. Infrastructure: The Event Bus (Simulating Kafka/RabbitMQ)
const messageBus = new EventEmitter();

// 2. Wire up the Projection (Subscriber)
messageBus.on('event_occurred', (event) => {
    // Simulate network latency for "Eventual Consistency"
    setTimeout(() => {
        Projector.handle(event);
    }, 100); 
});

// 3. Command Handler (The Write Side)
async function handleTransactionCommand(command) {
    const { aggregateId, type, amount } = command;
    let retries = 3;

    while (retries > 0) {
        try {
            // A. Load History
            const history = await EventStore.loadEvents(aggregateId);
            
            // B. Rehydrate Aggregate
            const account = new BankAccount(aggregateId, history);
            const expectedVersion = account.version;

            // C. Execute Logic
            let newEvent;
            if (type === 'DEPOSIT') newEvent = account.deposit(amount);
            else if (type === 'WITHDRAW') newEvent = account.withdraw(amount);

            // D. Persist with Optimistic Locking
            const savedEvents = await EventStore.saveEvents(aggregateId, [newEvent], expectedVersion);

            // E. Publish to Bus (Side effect after persistence)
            savedEvents.forEach(e => messageBus.emit('event_occurred', e));
            
            return { success: true, version: savedEvents[0].version };

        } catch (err) {
            // F. Retry on Concurrency Error
            if (err.message.includes('Concurrency Error')) {
                console.warn(`[Conflict] collision detected for ${aggregateId}. Retrying...`);
                retries--;
            } else {
                throw err; // Logic error (e.g., insufficient funds)
            }
        }
    }
    throw new Error("Transaction failed after retries due to high contention.");
}

// --- SIMULATION ---
async function runSimulation() {
    console.log("--- Starting Distributed CQRS System ---");

    const accId = "ACC-123";

    // Request 1: Deposit $100
    await handleTransactionCommand({ aggregateId: accId, type: 'DEPOSIT', amount: 100 });
    console.log("Write 1 confirmed.");

    // Request 2 & 3: Concurrent Withdrawals (Simulating race condition)
    // We fire these simultaneously without awaiting immediately
    const p1 = handleTransactionCommand({ aggregateId: accId, type: 'WITHDRAW', amount: 60 });
    const p2 = handleTransactionCommand({ aggregateId: accId, type: 'WITHDRAW', amount: 30 });

    try {
        await Promise.all([p1, p2]);
        console.log("Concurrent writes processed successfully.");
    } catch (e) {
        console.error("Transaction failed:", e.message);
    }

    // Check consistency
    console.log("\n--- Checking State ---");
    
    // Immediate check (Write model might be ahead of Read model due to eventual consistency)
    const history = await EventStore.loadEvents(accId);
    console.log(`Write Model Version: ${history.length}`);
    
    // Wait for projection
    setTimeout(() => {
        console.log(`Read Model Balance: $${Projector.getBalance(accId)}`);
        console.log("--- End Simulation ---");
    }, 1000);
}

module.exports = { runSimulation };