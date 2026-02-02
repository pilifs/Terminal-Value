// bankAccount.js
const AggregateRoot = require('../framework/aggregateRoot');

class BankAccount extends AggregateRoot {
    constructor(id, history) {
        super(id, history);
        // Initialize default domain state
        // Note: 'this.balance' will be mutated immediately by super() 
        // calling this.apply() if history exists.
        if (this.balance === undefined) this.balance = 0;
    }

    // --- DOMAIN LOGIC: STATE MUTATION ---
    // This is the "Left Fold" logic. It MUST be pure (no side effects, no randoms).
    apply(event) {
        switch (event.type) {
            case 'FUNDS_DEPOSITED':
                this.balance = (this.balance || 0) + event.amount;
                break;
            case 'FUNDS_WITHDRAWN':
                this.balance -= event.amount;
                break;
            default:
                // Ignore unknown events (helps with backward compatibility)
                break;
        }
    }

    // --- DOMAIN LOGIC: COMMANDS ---
    // These generate events but do not mutate state directly.
    
    deposit(amount) {
        if (amount <= 0) throw new Error("Deposit amount must be positive");
        
        return {
            type: 'FUNDS_DEPOSITED',
            aggregateId: this.id,
            amount: amount,
            timestamp: Date.now()
        };
    }

    withdraw(amount) {
        if (amount <= 0) throw new Error("Withdrawal amount must be positive");
        if (this.balance < amount) throw new Error("Insufficient funds");

        return {
            type: 'FUNDS_WITHDRAWN',
            aggregateId: this.id,
            amount: amount,
            timestamp: Date.now()
        };
    }
}

module.exports = BankAccount;