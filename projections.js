// projections.js
// This simulates a Read Database (e.g., Redis, ElasticSearch)
const readDatabase = new Map();

const AccountBalanceProjector = {
    handle: (event) => {
        const currentBalance = readDatabase.get(event.aggregateId) || 0;
        let newBalance = currentBalance;

        if (event.type === 'FUNDS_DEPOSITED') {
            newBalance += event.amount;
        } else if (event.type === 'FUNDS_WITHDRAWN') {
            newBalance -= event.amount;
        }

        readDatabase.set(event.aggregateId, newBalance);
        console.log(`[Read Model Updated] Account ${event.aggregateId} Balance: ${newBalance}`);
    },
    
    getBalance: (id) => readDatabase.get(id) || 0
};

module.exports = AccountBalanceProjector;