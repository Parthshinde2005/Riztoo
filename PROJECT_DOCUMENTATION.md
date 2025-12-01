# Riztoo E-commerce Platform - Complete Documentation

## 📋 Project Overview

**Riztoo** is a full-stack multi-vendor e-commerce platform designed for local stores to sell their products online. The platform supports three distinct user roles with different capabilities and workflows.

### Platform Purpose
- Enable local stores to create online presence without technical knowledge
- Allow customers to browse and purchase from multiple vendors in one place
- Provide admin oversight for quality control and platform management

---

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js (v16+)
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: Session-based (express-session + connect-mongo)
- **Password Security**: bcrypt (10 salt rounds)
- **File Upload**: Multer (local storage, Cloudinary-ready)
- **Payment**: Razorpay integration (with dummy simulator)
- **Security**: Helmet, CORS, Rate Limiting, Input Validation

### Frontend
- **HTML5**: Semantic markup
- **CSS**: Tailwind CSS (CDN)
- **JavaScript**: Vanilla JS (ES6+)
- **No Framework**: Pure client-side rendering

### Performance & Scalability
- **Caching**: node-cache for in-memory caching
- **Compression**: gzip/deflate compression
- **Rate Limiting**: express-rate-limit + express-slow-down
- **Clustering**: Node.js cluster mode support
- **Load Balancing**: Nginx (Docker setup)
- **Monitoring**: Prometheus + Grafana (optional)


---

## 🏗️ Architecture & Data Flow

### Database Schema

```
┌─────────────┐
│    User     │ (Authentication & Role)
└──────┬──────┘
       │
       ├──────────────┬──────────────┐
       │              │              │
       ▼              ▼              ▼
┌──────────┐   ┌──────────┐   ┌──────────┐
│ Customer │   │  Vendor  │   │  Admin   │
└──────────┘   └────┬─────┘   └──────────┘
                    │
                    ▼
            ┌───────────────┐
            │ Vendor Profile│ (Store Info)
            └───────┬───────┘
                    │
                    ▼
            ┌───────────────┐
            │VendorProduct  │ (Listings)
            └───────┬───────┘
                    │
                    ├──────────────┐
                    ▼              ▼
            ┌──────────┐    ┌──────────┐
            │ProductMaster│  │  Order   │
            └──────────┘    └────┬─────┘
                    │            │
                    └────┬───────┘
                         ▼
                    ┌──────────┐
                    │  Review  │
                    └──────────┘
```

### Key Collections

1. **User** - Authentication and role management
   - Fields: name, email, passwordHash, role, isGuest
   - Roles: customer, vendor, admin

2. **Vendor** - Store profiles
   - Fields: userId, storeName, companyName, description, images, location, verified
   - One-to-one with User (role: vendor)

3. **ProductMaster** - Global product catalog
   - Fields: name, slug, category, description, images
   - Shared across all vendors

4. **VendorProduct** - Vendor-specific listings
   - Fields: vendorId, productId, price, stock, images, isActive
   - Links vendors to products with their pricing

5. **Order** - Purchase records
   - Fields: userId, items[], totalAmount, status, paymentInfo
   - Status: pending → paid → shipped → delivered

6. **Review** - Product reviews
   - Fields: userId, orderId, productId, vendorId, rating, comment
   - Purchase-verified only

7. **Report** - User reports about vendors
   - Fields: reporterUserId, vendorId, reason, details, handled


---

## 👥 User Roles & Features

### 1. 🛍️ CUSTOMER Role

#### Registration & Authentication
- **Sign Up**: `/register` → Creates User with role='customer'
- **Login**: `/login/user` → Session-based authentication
- **Guest Mode**: Continue without account (limited features)

#### Core Features

**A. Product Browsing**
- View all products from multiple vendors
- Filter by category (Electronics, Fashion, Books, Home, Sports, Grocery)
- Filter by store/vendor
- Search products by name
- View product details with vendor pricing comparison
- See product images and descriptions

**B. Shopping Cart**
- Add products to cart (guest access allowed)
- Update quantities
- Remove items
- View cart total
- Cart persists in session

**C. Checkout & Payment**
- Review order summary
- Razorpay payment integration
- Dummy payment simulator for testing
- Order confirmation

**D. Order Management**
- View order history (`/profile` → My Orders)
- Track order status (pending → paid → shipped → delivered)
- View order details and items

**E. Reviews & Ratings**
- Rate products (1-5 stars) ONLY after purchase
- Write text reviews (max 500 chars)
- View all reviews for a product
- Purchase verification badge on reviews

**F. Vendor Reporting**
- Report vendors for issues
- Provide reason and details
- Admin reviews reports

**G. Profile Management**
- Update name and email
- View account information
- Change password

#### Customer Flow
```
1. Browse Catalog → 2. Add to Cart → 3. Checkout → 4. Payment → 5. Order Placed
                                                                        ↓
6. Receive Product → 7. Write Review ← (Only after purchase)
```

