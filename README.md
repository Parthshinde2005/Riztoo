# Riztoo - Multi-Role E-commerce Platform.

A Full-stack e-commerce platform for local stores with three distinct user roles: Customer, Vendor, and Admin.

## Features

### Customer Features
- Browse stores and products from multiple vendors (Electronics, Fashion, Books, Home, Sports, Grocery)
- Search and filter by category and store
- Add products to cart (guest access allowed)
- Checkout with dummy payment simulation
- Rate and review purchased products only
- Report vendors/stores for issues
- Order history and profile management

### Vendor Features
- Create and manage store profile with images
- Add products by choosing from master catalog or creating new ones
- Set vendor-specific pricing, stock, and images
- View and manage orders for their store
- Requires admin verification to start selling

### Admin Features
- Dashboard with platform statistics
- Manually approve/reject vendor applications
- View and handle user reports about vendors
- Delete users, vendors, or products as needed
- Read-only guest admin access for demo

## Tech Stack

- **Backend**: Node.js, Express.js, MongoDB (Mongoose)
- **Frontend**: HTML, CSS (Tailwind), Vanilla JavaScript
- **Authentication**: Session-based with express-session, bcrypt password hashing
- **File Upload**: Multer (local storage, configurable to Cloudinary)
- **Payment**: Dummy payment simulator
- **Database**: MongoDB (database name: riztoo)

## Project Structure

```
riztoo/
├── server/
│   ├── server.js              # Main server file
│   ├── models/                # MongoDB schemas
│   │   ├── User.js
│   │   ├── Vendor.js
│   │   ├── ProductMaster.js
│   │   ├── VendorProduct.js
│   │   ├── Order.js
│   │   ├── Review.js
│   │   └── Report.js
│   ├── routes/                # API routes
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── vendors.js
│   │   ├── products.js
│   │   ├── cart.js
│   │   ├── orders.js
│   │   ├── reviews.js
│   │   └── admin.js
│   ├── middlewares/           # Custom middleware
│   │   ├── auth.js
│   │   └── multer.js
│   ├── uploads/               # File uploads
│   │   ├── products/
│   │   └── stores/
│   └── utils/
│       └── seed.js            # Database seeding script
├── client/
│   └── public/                # Frontend files
│       ├── index.html         # Homepage with role selection
│       ├── login-user.html    # Customer login
│       ├── login-vendor.html  # Vendor login
│       ├── login-admin.html   # Admin login
│       ├── register.html      # Registration page
│       ├── catalog.html       # Product catalog
│       └── [other pages...]
├── .env                       # Environment variables
├── package.json
└── README.md
```

## Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or remote)
- npm or yarn

### Installation

1. **Clone and navigate to project**
   ```bash
   git clone <repository-url>
   cd riztoo
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   PORT=3000
   MONGO_URI=mongodb://localhost:27017/riztoo
   SESSION_SECRET=your_very_secret_key_change_in_production
   NODE_ENV=development
   UPLOAD_DIR=./server/uploads
   ```

4. **Start MongoDB**
   Make sure MongoDB is running on your system.

5. **Seed the database** (optional but recommended)
   ```bash
   npm run seed
   ```

6. **Start the server**
   ```bash
   # Development mode with auto-restart
   npm run dev
   
   # Production mode
   npm start
   ```

7. **Access the application**
   Open your browser and go to `http://localhost:3002`

## Test Accounts

After running the seed script, you can use these test accounts:

### Admin Accounts
- **Email**: admin@riztoo.test | **Password**: admin123
- **Email**: superadmin@riztoo.test | **Password**: admin123

### Customer Accounts
- **Email**: customer@test.com | **Password**: customer123
- **Email**: jane@test.com | **Password**: customer123

### Vendor Accounts
- **Email**: vendor@test.com | **Password**: vendor123 (VERIFIED)
- **Email**: fashion@test.com | **Password**: vendor123 (UNVERIFIED)
- **Email**: books@test.com | **Password**: vendor123 (UNVERIFIED)

## Login Pages

The platform has three separate login pages:

- **Customer Login**: `/login/user`
- **Vendor Login**: `/login/vendor`
- **Admin Login**: `/login/admin`

Each page includes a "Continue as Guest" button for demo purposes.

## API Endpoints

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/guest` - Create guest session
- `GET /auth/logout` - Logout
- `GET /auth/me` - Get current user

### Products
- `GET /products` - Get all products with vendor listings
- `GET /products/:id` - Get product details with reviews
- `GET /products/search/master` - Search product master catalog

### Cart & Orders
- `POST /cart/add` - Add item to cart
- `GET /cart` - Get cart contents
- `POST /orders/checkout` - Create order (dummy payment)
- `GET /orders/my-orders` - Get user orders

### Vendor (Protected)
- `GET /vendors/me` - Get vendor profile
- `PUT /vendors/me` - Update vendor profile
- `POST /vendors/products` - Create vendor product
- `GET /vendors/products` - Get vendor's products

### Admin (Protected)
- `GET /admin/dashboard` - Admin dashboard stats
- `GET /admin/vendors/unverified` - Get unverified vendors
- `POST /admin/vendors/:id/verify` - Verify vendor
- `GET /admin/reports` - Get user reports

## Security Features

- **Password Hashing**: bcrypt with salt rounds
- **Session Security**: httpOnly cookies, secure in production
- **Role-based Access Control**: Middleware protection for routes
- **Input Validation**: express-validator for API inputs
- **Rate Limiting**: Basic rate limiting on all routes
- **Helmet**: Security headers

## Database Schema

### Key Collections
- **Users**: Authentication and basic user info
- **Vendors**: Store profiles linked to vendor users
- **ProductMaster**: Global product catalog
- **VendorProduct**: Vendor-specific product listings
- **Orders**: Purchase records with items
- **Reviews**: Product reviews (purchase-verified)
- **Reports**: User reports about vendors

## Development

### Available Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run seed` - Seed database with sample data

### File Upload Configuration
By default, files are stored locally in `server/uploads/`. To use Cloudinary:

1. Install cloudinary: `npm install cloudinary`
2. Update `server/middlewares/multer.js` to use Cloudinary storage
3. Add Cloudinary credentials to `.env`

## Production Deployment

1. Set `NODE_ENV=production` in environment
2. Use a production MongoDB instance
3. Configure session store with connect-mongo
4. Set up proper SSL certificates
5. Use a reverse proxy (nginx) for static files
6. Configure file uploads for cloud storage

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details
