// Supabase Configuration - ADD THIS AT THE TOP
const supabaseUrl = 'https://natpgxzxuenierdsukow.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hdHBneHp4dWVuaWVyZHN1a293Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MDM1NTYsImV4cCI6MjA3NzM3OTU1Nn0.Oh3bQtQ9u0wBgnm-rEeuGiLkt_lPwBptVgFwd1cLpuk';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Enhanced Inventory Management System with Sales & Accounts Tracking
class InventoryManager {
    constructor() {
        this.items = JSON.parse(localStorage.getItem('petrosini_inventory')) || [];
        this.customers = JSON.parse(localStorage.getItem('petrosini_customers')) || [];
        this.transactions = JSON.parse(localStorage.getItem('petrosini_transactions')) || [];
        console.log('Enhanced inventory system loaded');
        this.init();
    }

    init() {
        this.syncWithSupabase(); // ADDED THIS LINE
        this.setupEventListeners();
        this.updateDashboard();
        this.setupTabs();
        
        // Display user info
        const currentUser = auth.getCurrentUser();
        if (currentUser && document.getElementById('userName')) {
            document.getElementById('userName').textContent = currentUser.name;
        }
    }

    // ADD THIS FUNCTION
    async syncWithSupabase() {
        try {
            const { data: items, error } = await supabase
                .from('inventory')
                .select('*');

            if (!error && items && items.length > 0) {
                this.items = items.map(item => ({
                    id: item.id,
                    name: item.item_name,
                    sku: item.sku,
                    quantity: item.quantity,
                    costPrice: item.cost_price,
                    sellingPrice: item.selling_price,
                    description: item.description,
                    minStock: item.min_stock,
                    lastUpdated: item.updated_at,
                    created: item.created_at
                }));
                this.saveToLocalStorage();
            }
            this.loadInventory();
        } catch (error) {
            console.log('Supabase load failed - using local storage');
            this.loadInventory();
        }
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Add item buttons
        document.getElementById('addItemBtn').addEventListener('click', () => this.showAddForm());
        document.getElementById('cancelBtn').addEventListener('click', () => this.hideForm());
        document.getElementById('logoutBtn').addEventListener('click', () => auth.logout());
        
        // Form submission
        document.getElementById('inventoryForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveItem();
        });
        
        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filterItems(e.target.value);
        });

        // Additional buttons
        document.getElementById('addSaleBtn').addEventListener('click', () => this.showQuickSaleForm());
        document.getElementById('addCustomerBtn').addEventListener('click', () => this.showAddCustomerForm());
        document.getElementById('filterSales').addEventListener('click', () => this.loadSalesReport());
        document.getElementById('customerSearch').addEventListener('input', (e) => this.filterCustomers(e.target.value));
        
        console.log('All event listeners setup successfully');
    }

    setupTabs() {
        const tabs = [
            { id: 'inventoryTab', content: 'inventoryContent' },
            { id: 'salesTab', content: 'salesContent' },
            { id: 'customersTab', content: 'customersContent' }
        ];
        
        tabs.forEach(tab => {
            const tabBtn = document.getElementById(tab.id);
            const tabContent = document.getElementById(tab.content);
            
            if (tabBtn && tabContent) {
                tabBtn.addEventListener('click', () => {
                    console.log(`Switching to ${tab.id}`);
                    
                    // Hide all tabs
                    document.querySelectorAll('.tab-content').forEach(content => {
                        content.classList.remove('active');
                    });
                    document.querySelectorAll('.tab-btn').forEach(btn => {
                        btn.classList.remove('active');
                    });
                    
                    // Show selected tab
                    tabContent.classList.add('active');
                    tabBtn.classList.add('active');
                    
                    // Load tab content
                    if (tab.id === 'salesTab') this.loadSalesReport();
                    if (tab.id === 'customersTab') this.loadCustomers();
                });
            }
        });
    }

    loadInventory() {
        const tbody = document.getElementById('inventoryTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (this.items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="empty-state">
                        <i class="fas fa-box-open"></i>
                        <p>No inventory items found</p>
                        <button class="btn btn-primary" id="addFirstItemBtn">
                            <i class="fas fa-plus"></i> Add Your First Item
                        </button>
                    </td>
                </tr>
            `;
            document.getElementById('addFirstItemBtn').addEventListener('click', () => this.showAddForm());
            return;
        }

        this.items.forEach(item => {
            const row = this.createTableRow(item);
            tbody.appendChild(row);
        });
    }

    createTableRow(item) {
        const row = document.createElement('tr');
        const totalValue = item.quantity * item.costPrice;
        const stockClass = item.quantity < (item.minStock || 10) ? 'low-stock' : '';
        
        // Get last sale/purchase info
        const lastTransaction = this.getLastTransaction(item.id);
        const lastAction = lastTransaction ? 
            `${lastTransaction.type === 'sale' ? 'Sold' : 'Purchased'} ${this.formatDate(lastTransaction.date)}` : 
            'No history';

        row.innerHTML = `
            <td data-label="SKU"><strong>${this.escapeHtml(item.sku)}</strong></td>
            <td data-label="Item Name">
                <div class="item-name">${this.escapeHtml(item.name)}</div>
                ${item.description ? `<div class="item-desc">${this.escapeHtml(item.description)}</div>` : ''}
            </td>
            <td data-label="Quantity" class="${stockClass}">${item.quantity}</td>
            <td data-label="Cost Price">₦${this.formatNumber(item.costPrice)}</td>
            <td data-label="Selling Price">₦${this.formatNumber(item.sellingPrice)}</td>
            <td data-label="Total Value">₦${this.formatNumber(totalValue)}</td>
            <td data-label="Last Action" class="last-action">${lastAction}</td>
            <td data-label="Profit Margin" class="profit-margin">
                ${this.calculateProfitMargin(item.costPrice, item.sellingPrice)}%
            </td>
            <td data-label="Actions" class="actions">
                <button class="btn btn-edit" data-id="${item.id}">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-sale" data-id="${item.id}">
                    <i class="fas fa-shopping-cart"></i> Sell
                </button>
                <button class="btn btn-danger" data-id="${item.id}">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        `;

        // Add event listeners
        const editBtn = row.querySelector('.btn-edit');
        const deleteBtn = row.querySelector('.btn-danger');
        const saleBtn = row.querySelector('.btn-sale');
        
        editBtn.addEventListener('click', () => this.editItem(item.id));
        deleteBtn.addEventListener('click', () => this.deleteItem(item.id));
        saleBtn.addEventListener('click', () => this.showSaleForm(item.id));

        return row;
    }

    showAddForm() {
        document.getElementById('formTitle').textContent = 'Add New Item';
        document.getElementById('inventoryForm').reset();
        document.getElementById('itemId').value = '';
        document.getElementById('itemForm').style.display = 'flex';
        
        setTimeout(() => {
            document.getElementById('itemName').focus();
        }, 100);
    }

    editItem(id) {
        const item = this.items.find(item => item.id === id);
        if (item) {
            document.getElementById('formTitle').textContent = 'Edit Item';
            document.getElementById('itemId').value = item.id;
            document.getElementById('itemName').value = item.name;
            document.getElementById('itemSku').value = item.sku;
            document.getElementById('quantity').value = item.quantity;
            document.getElementById('costPrice').value = item.costPrice;
            document.getElementById('sellingPrice').value = item.sellingPrice;
            document.getElementById('description').value = item.description || '';
            document.getElementById('minStock').value = item.minStock || 10;
            document.getElementById('itemForm').style.display = 'flex';
            
            setTimeout(() => {
                document.getElementById('itemName').focus();
            }, 100);
        }
    }

    async saveItem() { // CHANGED to async
        const id = document.getElementById('itemId').value;
        const name = document.getElementById('itemName').value.trim();
        const sku = document.getElementById('itemSku').value.trim();
        const quantity = parseInt(document.getElementById('quantity').value);
        const costPrice = parseFloat(document.getElementById('costPrice').value);
        const sellingPrice = parseFloat(document.getElementById('sellingPrice').value);
        const description = document.getElementById('description').value.trim();
        const minStock = parseInt(document.getElementById('minStock').value) || 10;

        // Validation
        if (!name || !sku) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        const itemData = {
            id: id || this.generateId(),
            name: name,
            sku: sku,
            quantity: quantity,
            costPrice: costPrice,
            sellingPrice: sellingPrice,
            description: description,
            minStock: minStock,
            lastUpdated: new Date().toISOString(),
            created: id ? this.items.find(item => item.id === id)?.created || new Date().toISOString() : new Date().toISOString()
        };

        if (id) {
            // Update existing item
            const index = this.items.findIndex(item => item.id === id);
            if (index !== -1) {
                this.items[index] = itemData;
                this.showNotification('Item updated successfully!', 'success');
            }
        } else {
            // Add new item
            this.items.push(itemData);
            this.showNotification('Item added successfully!', 'success');
        }

        this.saveToLocalStorage();
        this.loadInventory();
        this.updateDashboard();
        
        // ADDED SUPABASE SYNC
        try {
            const supabaseData = {
                item_name: name,
                sku: sku,
                quantity: quantity,
                cost_price: costPrice,
                selling_price: sellingPrice,
                description: description,
                min_stock: minStock,
                updated_at: new Date().toISOString()
            };

            if (id && id.startsWith('id_')) {
                supabaseData.created_at = new Date().toISOString();
                await supabase.from('inventory').insert([supabaseData]);
            } else if (id) {
                await supabase.from('inventory').update(supabaseData).eq('id', id);
            } else {
                supabaseData.created_at = new Date().toISOString();
                await supabase.from('inventory').insert([supabaseData]);
            }
        } catch (error) {
            console.error('Supabase sync failed:', error);
        }
        
        this.hideForm();
    }

    showSaleForm(itemId) {
        const item = this.items.find(item => item.id === itemId);
        if (!item) return;

        const saleFormHTML = `
            <div class="form-content">
                <h3>Sell Item: ${item.name}</h3>
                <form id="saleForm">
                    <input type="hidden" id="saleItemId" value="${item.id}">
                    
                    <div class="form-group">
                        <label for="saleQuantity">Quantity to Sell *</label>
                        <input type="number" id="saleQuantity" required min="1" max="${item.quantity}">
                        <small>Available: ${item.quantity} units</small>
                    </div>
                    
                    <div class="form-group">
                        <label for="salePrice">Selling Price (₦) *</label>
                        <input type="number" id="salePrice" step="0.01" required value="${item.sellingPrice}">
                    </div>
                    
                    <div class="form-group">
                        <label for="customerName">Customer Name</label>
                        <input type="text" id="customerName" placeholder="Enter customer name">
                    </div>
                    
                    <div class="form-group">
                        <label for="paymentStatus">Payment Status</label>
                        <select id="paymentStatus">
                            <option value="paid">Paid</option>
                            <option value="pending">Pending Payment</option>
                            <option value="credit">On Credit</option>
                        </select>
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.form-modal').remove()">Cancel</button>
                        <button type="submit" class="btn btn-primary">Record Sale</button>
                    </div>
                </form>
            </div>
        `;

        const modal = document.createElement('div');
        modal.className = 'form-modal';
        modal.style.display = 'flex';
        modal.innerHTML = saleFormHTML;
        document.body.appendChild(modal);

        modal.querySelector('#saleForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.recordSale(itemId, modal);
        });
    }

    showQuickSaleForm() {
        if (this.items.length === 0) {
            this.showNotification('No items available for sale. Please add inventory first.', 'error');
            return;
        }

        const quickSaleHTML = `
            <div class="form-content" style="max-width: 700px;">
                <h3>Record Quick Sale</h3>
                <form id="quickSaleForm">
                    <div class="form-group">
                        <label for="saleItemSelect">Select Item *</label>
                        <select id="saleItemSelect" required>
                            <option value="">Choose an item...</option>
                            ${this.items.map(item => 
                                `<option value="${item.id}" data-price="${item.sellingPrice}" data-stock="${item.quantity}">
                                    ${item.name} (Stock: ${item.quantity}) - ₦${this.formatNumber(item.sellingPrice)}
                                </option>`
                            ).join('')}
                        </select>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="quickSaleQuantity">Quantity *</label>
                            <input type="number" id="quickSaleQuantity" required min="1">
                        </div>
                        
                        <div class="form-group">
                            <label for="quickSalePrice">Price (₦) *</label>
                            <input type="number" id="quickSalePrice" step="0.01" required>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="quickCustomerName">Customer Name</label>
                        <input type="text" id="quickCustomerName" placeholder="Enter customer name">
                    </div>
                    
                    <div class="form-group">
                        <label for="quickPaymentStatus">Payment Status</label>
                        <select id="quickPaymentStatus">
                            <option value="paid">Paid</option>
                            <option value="pending">Pending Payment</option>
                            <option value="credit">On Credit</option>
                        </select>
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.form-modal').remove()">Cancel</button>
                        <button type="submit" class="btn btn-primary">Record Sale</button>
                    </div>
                </form>
            </div>
        `;

        const modal = document.createElement('div');
        modal.className = 'form-modal';
        modal.style.display = 'flex';
        modal.innerHTML = quickSaleHTML;
        document.body.appendChild(modal);

        // Update price when item selected
        modal.querySelector('#saleItemSelect').addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            if (selectedOption.value) {
                modal.querySelector('#quickSalePrice').value = selectedOption.getAttribute('data-price');
                modal.querySelector('#quickSaleQuantity').setAttribute('max', selectedOption.getAttribute('data-stock'));
            }
        });

        modal.querySelector('#quickSaleForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.recordQuickSale(modal);
        });
    }

    recordSale(itemId, modal) {
        const item = this.items.find(item => item.id === itemId);
        const quantity = parseInt(modal.querySelector('#saleQuantity').value);
        const price = parseFloat(modal.querySelector('#salePrice').value);
        const customerName = modal.querySelector('#customerName').value.trim();
        const paymentStatus = modal.querySelector('#paymentStatus').value;

        if (quantity > item.quantity) {
            this.showNotification('Not enough stock available!', 'error');
            return;
        }

        // Update inventory
        item.quantity -= quantity;
        item.lastUpdated = new Date().toISOString();

        // Record transaction
        const transaction = {
            id: this.generateId(),
            type: 'sale',
            itemId: itemId,
            itemName: item.name,
            quantity: quantity,
            price: price,
            total: quantity * price,
            customerName: customerName || 'Walk-in Customer',
            paymentStatus: paymentStatus,
            date: new Date().toISOString(),
            recordedBy: auth.getCurrentUser().name
        };

        this.transactions.push(transaction);

        // Update customer if credit sale
        if ((paymentStatus === 'credit' || paymentStatus === 'pending') && customerName) {
            this.updateCustomerCredit(customerName, quantity * price);
        }

        this.saveToLocalStorage();
        this.loadInventory();
        this.updateDashboard();
        modal.remove();
        
        this.showNotification(`Sale recorded successfully! ${quantity} units of ${item.name} sold.`, 'success');
    }

    recordQuickSale(modal) {
        const itemId = modal.querySelector('#saleItemSelect').value;
        const item = this.items.find(item => item.id === itemId);
        const quantity = parseInt(modal.querySelector('#quickSaleQuantity').value);
        const price = parseFloat(modal.querySelector('#quickSalePrice').value);
        const customerName = modal.querySelector('#quickCustomerName').value.trim();
        const paymentStatus = modal.querySelector('#quickPaymentStatus').value;

        if (!item) {
            this.showNotification('Please select an item!', 'error');
            return;
        }

        if (quantity > item.quantity) {
            this.showNotification('Not enough stock available!', 'error');
            return;
        }

        // Update inventory
        item.quantity -= quantity;
        item.lastUpdated = new Date().toISOString();

        // Record transaction
        const transaction = {
            id: this.generateId(),
            type: 'sale',
            itemId: itemId,
            itemName: item.name,
            quantity: quantity,
            price: price,
            total: quantity * price,
            customerName: customerName || 'Walk-in Customer',
            paymentStatus: paymentStatus,
            date: new Date().toISOString(),
            recordedBy: auth.getCurrentUser().name
        };

        this.transactions.push(transaction);

        // Update customer if credit sale
        if ((paymentStatus === 'credit' || paymentStatus === 'pending') && customerName) {
            this.updateCustomerCredit(customerName, quantity * price);
        }

        this.saveToLocalStorage();
        this.loadInventory();
        this.updateDashboard();
        modal.remove();
        
        this.showNotification(`Sale recorded successfully! ${quantity} units of ${item.name} sold.`, 'success');
    }

    updateCustomerCredit(customerName, amount) {
        let customer = this.customers.find(c => c.name.toLowerCase() === customerName.toLowerCase());
        if (!customer) {
            customer = {
                id: this.generateId(),
                name: customerName,
                phone: '',
                totalPurchases: amount,
                creditBalance: amount,
                lastPurchase: new Date().toISOString()
            };
            this.customers.push(customer);
        } else {
            customer.totalPurchases += amount;
            customer.creditBalance += amount;
            customer.lastPurchase = new Date().toISOString();
        }
        this.saveToLocalStorage();
    }

    loadSalesReport() {
        const tbody = document.getElementById('salesTableBody');
        if (!tbody) return;

        // Get filter dates
        const startDate = document.getElementById('startDate')?.value;
        const endDate = document.getElementById('endDate')?.value;

        let filteredTransactions = this.transactions.filter(t => t.type === 'sale');

        if (startDate) {
            filteredTransactions = filteredTransactions.filter(t => new Date(t.date) >= new Date(startDate));
        }
        if (endDate) {
            filteredTransactions = filteredTransactions.filter(t => new Date(t.date) <= new Date(endDate + 'T23:59:59'));
        }

        // Sort by date (newest first)
        filteredTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        tbody.innerHTML = '';

        if (filteredTransactions.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="empty-state">
                        <i class="fas fa-receipt"></i>
                        <p>No sales transactions found</p>
                    </td>
                </tr>
            `;
        } else {
            filteredTransactions.forEach(transaction => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td data-label="Date">${this.formatDate(transaction.date)}</td>
                    <td data-label="Item">${transaction.itemName}</td>
                    <td data-label="Quantity">${transaction.quantity}</td>
                    <td data-label="Price">₦${this.formatNumber(transaction.price)}</td>
                    <td data-label="Total">₦${this.formatNumber(transaction.total)}</td>
                    <td data-label="Customer">${transaction.customerName}</td>
                    <td data-label="Payment Status">
                        <span class="payment-status ${transaction.paymentStatus}">
                            ${transaction.paymentStatus}
                        </span>
                    </td>
                    <td data-label="Recorded By">${transaction.recordedBy}</td>
                    <td data-label="Actions" class="actions">
                        <button class="btn btn-edit" onclick="inventory.editSaleTransaction('${transaction.id}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }

        // Update sales stats
        this.updateSalesStats(filteredTransactions);
    }

    editSaleTransaction(transactionId) {
        const transaction = this.transactions.find(t => t.id === transactionId);
        if (!transaction) return;

        const editFormHTML = `
            <div class="form-content">
                <h3>Edit Sale Transaction</h3>
                <form id="editSaleForm">
                    <input type="hidden" id="editTransactionId" value="${transaction.id}">
                    
                    <div class="form-group">
                        <label>Item: ${transaction.itemName}</label>
                    </div>
                    
                    <div class="form-group">
                        <label for="editSaleQuantity">Quantity *</label>
                        <input type="number" id="editSaleQuantity" value="${transaction.quantity}" required min="1">
                    </div>
                    
                    <div class="form-group">
                        <label for="editSalePrice">Price (₦) *</label>
                        <input type="number" id="editSalePrice" value="${transaction.price}" step="0.01" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="editCustomerName">Customer Name</label>
                        <input type="text" id="editCustomerName" value="${transaction.customerName}">
                    </div>
                    
                    <div class="form-group">
                        <label for="editPaymentStatus">Payment Status</label>
                        <select id="editPaymentStatus">
                            <option value="paid" ${transaction.paymentStatus === 'paid' ? 'selected' : ''}>Paid</option>
                            <option value="pending" ${transaction.paymentStatus === 'pending' ? 'selected' : ''}>Pending Payment</option>
                            <option value="credit" ${transaction.paymentStatus === 'credit' ? 'selected' : ''}>On Credit</option>
                        </select>
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.form-modal').remove()">Cancel</button>
                        <button type="submit" class="btn btn-primary">Update Sale</button>
                    </div>
                </form>
            </div>
        `;

        const modal = document.createElement('div');
        modal.className = 'form-modal';
        modal.style.display = 'flex';
        modal.innerHTML = editFormHTML;
        document.body.appendChild(modal);

        modal.querySelector('#editSaleForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateSaleTransaction(transactionId, modal);
        });
    }

    updateSaleTransaction(transactionId, modal) {
        const transaction = this.transactions.find(t => t.id === transactionId);
        if (!transaction) return;

        const oldQuantity = transaction.quantity;
        const oldTotal = transaction.total;
        const oldPaymentStatus = transaction.paymentStatus;
        const oldCustomerName = transaction.customerName;

        const newQuantity = parseInt(modal.querySelector('#editSaleQuantity').value);
        const newPrice = parseFloat(modal.querySelector('#editSalePrice').value);
        const newCustomerName = modal.querySelector('#editCustomerName').value.trim();
        const newPaymentStatus = modal.querySelector('#editPaymentStatus').value;

        // Update the item quantity if it changed
        const item = this.items.find(item => item.id === transaction.itemId);
        if (item) {
            // Restore old quantity first
            item.quantity += oldQuantity;
            // Then subtract new quantity
            item.quantity -= newQuantity;
            item.lastUpdated = new Date().toISOString();
        }

        // Update transaction
        transaction.quantity = newQuantity;
        transaction.price = newPrice;
        transaction.total = newQuantity * newPrice;
        transaction.customerName = newCustomerName;
        transaction.paymentStatus = newPaymentStatus;

        // Update customer credit if payment status changed
        if ((oldPaymentStatus === 'credit' || oldPaymentStatus === 'pending') && oldCustomerName) {
            this.updateCustomerCredit(oldCustomerName, -oldTotal); // Remove old amount
        }
        if ((newPaymentStatus === 'credit' || newPaymentStatus === 'pending') && newCustomerName) {
            this.updateCustomerCredit(newCustomerName, transaction.total); // Add new amount
        }

        this.saveToLocalStorage();
        this.loadInventory();
        this.loadSalesReport();
        this.updateDashboard();
        modal.remove();
        
        this.showNotification('Sale transaction updated successfully!', 'success');
    }

    updateSalesStats(transactions) {
        const totalSales = transactions.reduce((sum, t) => sum + t.total, 0);
        
        // Calculate pending payments from customer balances
        const pendingPayments = this.customers.reduce((sum, customer) => sum + customer.creditBalance, 0);
        
        const unitsSold = transactions.reduce((sum, t) => sum + t.quantity, 0);

        if (document.getElementById('totalSales')) {
            document.getElementById('totalSales').textContent = `₦${this.formatNumber(totalSales)}`;
        }
        if (document.getElementById('pendingPayments')) {
            document.getElementById('pendingPayments').textContent = `₦${this.formatNumber(pendingPayments)}`;
        }
        if (document.getElementById('unitsSold')) {
            document.getElementById('unitsSold').textContent = unitsSold;
        }
    }

    loadCustomers() {
        const tbody = document.getElementById('customersTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (this.customers.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <i class="fas fa-users"></i>
                        <p>No customers found</p>
                    </td>
                </tr>
            `;
        } else {
            this.customers.forEach(customer => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td data-label="Customer Name"><strong>${customer.name}</strong></td>
                    <td data-label="Phone Number">${customer.phone || 'N/A'}</td>
                    <td data-label="Total Purchases">₦${this.formatNumber(customer.totalPurchases)}</td>
                    <td data-label="Credit Balance">₦${this.formatNumber(customer.creditBalance)}</td>
                    <td data-label="Last Purchase">${this.formatDate(customer.lastPurchase)}</td>
                    <td data-label="Actions" class="actions">
                        ${customer.creditBalance > 0 ? `
                            <button class="btn btn-warning" onclick="inventory.collectPayment('${customer.id}')">
                                <i class="fas fa-money-bill-wave"></i> Collect
                            </button>
                        ` : '<span style="color: #27ae60; font-weight: bold;">Paid</span>'}
                        <button class="btn btn-edit" onclick="inventory.editCustomer('${customer.id}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }
    }

    editCustomer(customerId) {
        const customer = this.customers.find(c => c.id === customerId);
        if (!customer) return;

        const editFormHTML = `
            <div class="form-content">
                <h3>Edit Customer</h3>
                <form id="editCustomerForm">
                    <input type="hidden" id="editCustomerId" value="${customer.id}">
                    
                    <div class="form-group">
                        <label for="editCustomerName">Customer Name *</label>
                        <input type="text" id="editCustomerName" value="${customer.name}" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="editCustomerPhone">Phone Number</label>
                        <input type="tel" id="editCustomerPhone" value="${customer.phone || ''}">
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.form-modal').remove()">Cancel</button>
                        <button type="submit" class="btn btn-primary">Update Customer</button>
                    </div>
                </form>
            </div>
        `;

        const modal = document.createElement('div');
        modal.className = 'form-modal';
        modal.style.display = 'flex';
        modal.innerHTML = editFormHTML;
        document.body.appendChild(modal);

        modal.querySelector('#editCustomerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateCustomer(customerId, modal);
        });
    }

    updateCustomer(customerId, modal) {
        const customer = this.customers.find(c => c.id === customerId);
        if (!customer) return;

        const oldName = customer.name;
        const newName = modal.querySelector('#editCustomerName').value.trim();
        const newPhone = modal.querySelector('#editCustomerPhone').value.trim();

        customer.name = newName;
        customer.phone = newPhone;

        // Update customer name in all transactions
        this.transactions.forEach(transaction => {
            if (transaction.customerName === oldName) {
                transaction.customerName = newName;
            }
        });

        this.saveToLocalStorage();
        this.loadCustomers();
        this.loadSalesReport();
        modal.remove();
        
        this.showNotification('Customer updated successfully!', 'success');
    }

    filterCustomers(searchTerm) {
        if (!searchTerm) {
            this.loadCustomers();
            return;
        }

        const filteredCustomers = this.customers.filter(customer =>
            customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (customer.phone && customer.phone.includes(searchTerm))
        );

        const tbody = document.getElementById('customersTableBody');
        tbody.innerHTML = '';

        if (filteredCustomers.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: #666;">
                        No customers found matching "${searchTerm}"
                    </td>
                </tr>
            `;
            return;
        }

        filteredCustomers.forEach(customer => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td data-label="Customer Name"><strong>${customer.name}</strong></td>
                <td data-label="Phone Number">${customer.phone || 'N/A'}</td>
                <td data-label="Total Purchases">₦${this.formatNumber(customer.totalPurchases)}</td>
                <td data-label="Credit Balance">₦${this.formatNumber(customer.creditBalance)}</td>
                <td data-label="Last Purchase">${this.formatDate(customer.lastPurchase)}</td>
                <td data-label="Actions" class="actions">
                    ${customer.creditBalance > 0 ? `
                        <button class="btn btn-warning" onclick="inventory.collectPayment('${customer.id}')">
                            <i class="fas fa-money-bill-wave"></i> Collect
                        </button>
                    ` : '<span style="color: #27ae60; font-weight: bold;">Paid</span>'}
                    <button class="btn btn-edit" onclick="inventory.editCustomer('${customer.id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    collectPayment(customerId) {
        const customer = this.customers.find(c => c.id === customerId);
        if (!customer) {
            this.showNotification('Customer not found!', 'error');
            return;
        }

        if (customer.creditBalance <= 0) {
            this.showNotification('This customer has no outstanding balance!', 'info');
            return;
        }

        const amount = prompt(
            `Collect payment from ${customer.name}\n\nOutstanding Balance: ₦${this.formatNumber(customer.creditBalance)}\n\nEnter amount to collect:`,
            customer.creditBalance.toString()
        );
        
        if (amount === null) return; // User clicked cancel

        const paymentAmount = parseFloat(amount);
        
        if (isNaN(paymentAmount) || paymentAmount <= 0) {
            this.showNotification('Please enter a valid amount!', 'error');
            return;
        }

        if (paymentAmount > customer.creditBalance) {
            this.showNotification('Payment amount cannot exceed outstanding balance!', 'error');
            return;
        }

        // Update customer balance
        customer.creditBalance -= paymentAmount;
        customer.lastPurchase = new Date().toISOString();
        
        // Record payment transaction
        const paymentTransaction = {
            id: this.generateId(),
            type: 'payment',
            customerId: customerId,
            customerName: customer.name,
            amount: paymentAmount,
            date: new Date().toISOString(),
            recordedBy: auth.getCurrentUser().name
        };

        this.transactions.push(paymentTransaction);

        // Update sales transactions payment status
        this.updateSalesTransactionsPaymentStatus(customerId, paymentAmount);

        this.saveToLocalStorage();
        this.loadCustomers();
        this.loadSalesReport();
        this.updateDashboard();
        
        if (customer.creditBalance === 0) {
            this.showNotification(`Full payment of ₦${this.formatNumber(paymentAmount)} collected from ${customer.name}. Balance cleared! ✅`, 'success');
        } else {
            this.showNotification(`Payment of ₦${this.formatNumber(paymentAmount)} collected from ${customer.name}. Remaining balance: ₦${this.formatNumber(customer.creditBalance)}`, 'success');
        }
    }

    updateSalesTransactionsPaymentStatus(customerId, paymentAmount) {
        const customer = this.customers.find(c => c.id === customerId);
        if (!customer) return;

        let remainingPayment = paymentAmount;
        
        // Find all unpaid sales transactions for this customer (oldest first)
        const unpaidTransactions = this.transactions
            .filter(t => 
                t.type === 'sale' && 
                t.customerName === customer.name && 
                (t.paymentStatus === 'credit' || t.paymentStatus === 'pending')
            )
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        // Apply payment to the transactions (oldest first)
        unpaidTransactions.forEach(transaction => {
            if (remainingPayment <= 0) return;

            if (remainingPayment >= transaction.total) {
                // Full payment for this transaction
                transaction.paymentStatus = 'paid';
                remainingPayment -= transaction.total;
            }
        });
    }

    showAddCustomerForm() {
        const formHTML = `
            <div class="form-content">
                <h3>Add New Customer</h3>
                <form id="customerForm">
                    <div class="form-group">
                        <label for="customerName">Customer Name *</label>
                        <input type="text" id="customerName" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="customerPhone">Phone Number</label>
                        <input type="tel" id="customerPhone">
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.form-modal').remove()">Cancel</button>
                        <button type="submit" class="btn btn-primary">Add Customer</button>
                    </div>
                </form>
            </div>
        `;

        const modal = document.createElement('div');
        modal.className = 'form-modal';
        modal.style.display = 'flex';
        modal.innerHTML = formHTML;
        document.body.appendChild(modal);

        modal.querySelector('#customerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCustomer(modal);
        });
    }

    saveCustomer(modal) {
        const name = modal.querySelector('#customerName').value.trim();
        const phone = modal.querySelector('#customerPhone').value.trim();

        const customer = {
            id: this.generateId(),
            name: name,
            phone: phone,
            totalPurchases: 0,
            creditBalance: 0,
            lastPurchase: new Date().toISOString()
        };

        this.customers.push(customer);
        this.saveToLocalStorage();
        this.loadCustomers();
        modal.remove();
        
        this.showNotification(`Customer ${name} added successfully!`, 'success');
    }

    deleteItem(id) {
        if (confirm('Are you sure you want to delete this item?')) {
            this.items = this.items.filter(item => item.id !== id);
            this.saveToLocalStorage();
            this.loadInventory();
            this.updateDashboard();
            this.showNotification('Item deleted successfully!', 'success');
        }
    }

    filterItems(searchTerm) {
        if (!searchTerm) {
            this.loadInventory();
            return;
        }

        const filteredItems = this.items.filter(item => 
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()))
        );

        const tbody = document.getElementById('inventoryTableBody');
        tbody.innerHTML = '';

        if (filteredItems.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 40px; color: #666;">
                        No items found matching "${searchTerm}"
                    </td>
                </tr>
            `;
            return;
        }

        filteredItems.forEach(item => {
            const row = this.createTableRow(item);
            tbody.appendChild(row);
        });
    }

    updateDashboard() {
        const totalItems = this.items.length;
        const totalStockValue = this.items.reduce((sum, item) => sum + (item.quantity * item.costPrice), 0);
        const lowStockItems = this.items.filter(item => item.quantity < (item.minStock || 10)).length;
        
        // Calculate accounts receivable from customer balances
        const accountsReceivable = this.customers.reduce((sum, customer) => sum + customer.creditBalance, 0);
        
        // Calculate today's sales
        const today = new Date().toDateString();
        const todaySales = this.transactions
            .filter(t => new Date(t.date).toDateString() === today && t.type === 'sale')
            .reduce((sum, t) => sum + t.total, 0);

        // Update dashboard cards
        document.getElementById('totalItems').textContent = totalItems;
        document.getElementById('totalValue').textContent = `₦${this.formatNumber(totalStockValue)}`;
        document.getElementById('lowStock').textContent = lowStockItems;
        document.getElementById('accountsReceivable').textContent = `₦${this.formatNumber(accountsReceivable)}`;
        document.getElementById('todaySales').textContent = `₦${this.formatNumber(todaySales)}`;
    }

    // Helper methods
    getLastTransaction(itemId) {
        const itemTransactions = this.transactions
            .filter(t => t.itemId === itemId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        return itemTransactions[0];
    }

    calculateProfitMargin(costPrice, sellingPrice) {
        if (costPrice === 0) return 0;
        return (((sellingPrice - costPrice) / costPrice) * 100).toFixed(1);
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-NG', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    formatNumber(number) {
        return parseFloat(number).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
    }

    generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    saveToLocalStorage() {
        localStorage.setItem('petrosini_inventory', JSON.stringify(this.items));
        localStorage.setItem('petrosini_customers', JSON.stringify(this.customers));
        localStorage.setItem('petrosini_transactions', JSON.stringify(this.transactions));
    }

    hideForm() {
        document.getElementById('itemForm').style.display = 'none';
    }

    showNotification(message, type = 'success') {
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());

        const notification = document.createElement('div');
        notification.className = `notification ${type === 'error' ? 'error' : ''}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">&times;</button>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize when page loads
let inventory;
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, checking auth...');
    
    if (auth.checkAuth()) {
        console.log('Auth successful, initializing inventory...');
        inventory = new InventoryManager();
    }
});
// Enhanced mobile functionality
document.addEventListener('DOMContentLoaded', function() {
    // Improve touch experience for tabs on mobile
    const tabButtons = document.querySelectorAll('.tab-btn');
    
    tabButtons.forEach(button => {
        // Add touch feedback
        button.addEventListener('touchstart', function() {
            this.style.transform = 'scale(0.98)';
        });
        
        button.addEventListener('touchend', function() {
            this.style.transform = 'scale(1)';
        });
    });
    
    // Enhanced table row interactions for mobile
    const tableRows = document.querySelectorAll('tbody tr');
    tableRows.forEach(row => {
        row.addEventListener('click', function(e) {
            // Only trigger on mobile and if not clicking a button
            if (window.innerWidth <= 768 && !e.target.closest('button')) {
                this.classList.toggle('expanded');
            }
        });
    });
});
