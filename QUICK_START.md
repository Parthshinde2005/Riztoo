# Riztoo - Quick Start Guide

## 🚀 Start the Application

```bash
# Install dependencies (first time only)
npm install

# Start the server
npm start

# Or with auto-restart (development)
npm run dev
```

Server will start at: **http://localhost:3002**

---

## 👥 Test Accounts

### Admin
- **URL**: http://localhost:3002/login/admin
- **Email**: admin@riztoo.test
- **Password**: admin123

### Vendor (Verified)
- **URL**: http://localhost:3002/login/vendor
- **Email**: vendor@test.com
- **Password**: vendor123
- **Dashboard**: http://localhost:3002/vendor-dashboard.html

### Customer
- **URL**: http://localhost:3002/login/user
- **Email**: customer@test.com
- **Password**: customer123

---

## 🛍️ Vendor Quick Actions

### 1. Add Product
```
1. Login as vendor
2. Go to: http://localhost:3002/vendor-dashboard.html
3. Click "Add Product"
4. Choose method:
   - Select from catalog (search existing)
   - Create new product
5. Fill in price and stock
6. Upload images (optional)
7. Click "Add Product"
```

### 2. View Orders
```
1. Dashboard → Orders tab
2. Filter by status if needed
3. View customer details
```

### 3. Check Earnings
```
1. Dashboard → Analytics tab
2. View total sales
3. See commission breakdown
4. Check transaction history
```

### 4. Manage Products
```
1. Dashboard → Products tab
2. Search products
3. Edit (coming soon) or Delete
```

---

## 🛠️ Useful Commands

```bash
# Database
npm run seed              # Add sample data
npm run clear-products    # Remove all products
npm run fix:bugs          # Check database integrity

# Monitoring
npm run health            # Check server health
npm run metrics           # View performance stats

# Testing
npm run load-test         # Run load test
```

---

## 📝 Key Features

### ✅ Working Now
- Vendor registration & login
- Add products (2 methods)
- Delete products
- View orders
- View reviews
- Track earnings
- Profile management

### ⚠️ Coming Soon
- Edit product UI
- Order status updates
- Real-time dashboard stats

---

## 🐛 Troubleshooting

**Dashboard not loading?**
→ Make sure you're logged in as vendor

**Can't add products?**
→ Admin must verify your vendor account first

**No earnings showing?**
→ Need completed orders first

**Images not uploading?**
→ Max 5MB, formats: JPG, PNG, GIF, WEBP

---

## 📚 Documentation

- `PROJECT_DOCUMENTATION.md` - Complete project overview
- `CODE_REVIEW_REPORT.md` - Code analysis
- `VENDOR_FEATURES_ANALYSIS.md` - Feature details
- `VENDOR_DASHBOARD_COMPLETE_FIX.md` - Dashboard guide
- `FINAL_SUMMARY.md` - Complete summary

---

## ✅ Status

**Version**: 1.0.0  
**Status**: ✅ Production Ready  
**Completion**: 90%  
**Last Updated**: November 27, 2025

---

**Need Help?** Check the documentation files above!
