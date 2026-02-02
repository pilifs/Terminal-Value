// aggregate.js
class BankAccount {
    constructor(id, history = []) {
        this.id = id;
        this.balance = 0;
        this.version = 0;
        
        // Rehydrate state from history
        history.forEach(event => this.apply(event, false));
    }

    // The internal state transition function
    apply(event, isNew = true) {
        switch (event.type) {
            case 'FUNDS_DEPOSITED':
                this.balance += event.amount;
                break;
            case 'FUNDS_WITHDRAWN':
                this.balance -= event.amount;
                break;
        }
        if (!isNew) this.version = event.version;
    }

    // Command: Deposit
    deposit(amount) {
        if (amount <= 0) throw new Error("Amount must be positive");
        return {
            type: 'FUNDS_DEPOSITED',
            aggregateId: this.id,
            amount: amount,
            timestamp: Date.now()
        };
    }

    // Command: Withdraw
    withdraw(amount) {
        if (amount <= 0) throw new Error("Amount must be positive");
        if (this.balance < amount) throw new Error("Insufficient funds"); // Business Rule
        return {
            type: 'FUNDS_WITHDRAWN',
            aggregateId: this.id,
            amount: amount,
            timestamp: Date.now()
        };
    }
}

module.exports = BankAccount;