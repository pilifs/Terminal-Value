const AggregateRoot = require('../framework/aggregateRoot');

class Order extends AggregateRoot {
    constructor(id, history) {
        super(id, history, {
            id: id,
            orderType: null, // 'PURCHASE' or 'RESTOCK'
            clientId: null,  // Null if RESTOCK
            items: [],       // Array of { itemId, quantity, price }
            status: 'DRAFT', // DRAFT, CONFIRMED, CANCELLED
            totalAmount: 0
        });
    }

    apply(event) {
        switch (event.type) {
            case 'ORDER_INITIATED':
                this.orderType = event.orderType;
                this.clientId = event.clientId || null;
                this.status = 'DRAFT';
                break;
            case 'ITEM_ADDED_TO_ORDER':
                this.items.push({ 
                    itemId: event.itemId, 
                    quantity: event.quantity, 
                    price: event.price 
                });
                this.totalAmount += (event.price * event.quantity);
                break;
            case 'ORDER_CONFIRMED':
                this.status = 'CONFIRMED';
                break;
        }
    }

    // Command: Start a Client Purchase
    initiatePurchase(clientId) {
        if (this.status !== 'DRAFT' && this.status !== undefined) {
             throw new Error("Order already exists");
        }
        return {
            type: 'ORDER_INITIATED',
            aggregateId: this.id,
            orderType: 'PURCHASE',
            clientId,
            timestamp: Date.now()
        };
    }

    // Command: Start a Restock Order (No client involved)
    initiateRestock() {
        if (this.status !== 'DRAFT' && this.status !== undefined) {
             throw new Error("Order already exists");
        }
        return {
            type: 'ORDER_INITIATED',
            aggregateId: this.id,
            orderType: 'RESTOCK',
            clientId: null,
            timestamp: Date.now()
        };
    }

    addItem(itemId, quantity, price) {
        if (this.status !== 'DRAFT') throw new Error("Cannot add items to a confirmed order");
        return {
            type: 'ITEM_ADDED_TO_ORDER',
            aggregateId: this.id,
            itemId,
            quantity,
            price,
            timestamp: Date.now()
        };
    }

    confirm() {
        if (this.items.length === 0) throw new Error("Cannot confirm empty order");
        return {
            type: 'ORDER_CONFIRMED',
            aggregateId: this.id,
            timestamp: Date.now()
        };
    }
}

module.exports = Order;