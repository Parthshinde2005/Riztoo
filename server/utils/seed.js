const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

const User = require('../models/User');
const Vendor = require('../models/Vendor');
const ProductMaster = require('../models/ProductMaster');
const VendorProduct = require('../models/VendorProduct');

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Vendor.deleteMany({});
    await ProductMaster.deleteMany({});
    await VendorProduct.deleteMany({});
    console.log('Cleared existing data');

    // Create admin users
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin1 = await User.create({
      name: 'Admin User',
      email: 'admin@riztoo.test',
      passwordHash: adminPassword,
      role: 'admin'
    });

    const admin2 = await User.create({
      name: 'Super Admin',
      email: 'superadmin@riztoo.test',
      passwordHash: adminPassword,
      role: 'admin'
    });

    console.log('Created admin users');

    // Create customer users
    const customerPassword = await bcrypt.hash('customer123', 10);
    const customer1 = await User.create({
      name: 'John Customer',
      email: 'customer@test.com',
      passwordHash: customerPassword,
      role: 'customer'
    });

    const customer2 = await User.create({
      name: 'Jane Buyer',
      email: 'jane@test.com',
      passwordHash: customerPassword,
      role: 'customer'
    });

    console.log('Created customer users');

    // Create vendor users
    const vendorPassword = await bcrypt.hash('vendor123', 10);
    
    const vendor1User = await User.create({
      name: 'Tech Store Owner',
      email: 'vendor@test.com',
      passwordHash: vendorPassword,
      role: 'vendor'
    });

    const vendor2User = await User.create({
      name: 'Fashion Store Owner',
      email: 'fashion@test.com',
      passwordHash: vendorPassword,
      role: 'vendor'
    });

    const vendor3User = await User.create({
      name: 'Book Store Owner',
      email: 'books@test.com',
      passwordHash: vendorPassword,
      role: 'vendor'
    });

    console.log('Created vendor users');

    // Create vendor profiles
    const vendor1 = await Vendor.create({
      userId: vendor1User._id,
      storeName: 'TechHub Electronics',
      companyName: 'TechHub Pvt Ltd',
      description: 'Your one-stop shop for all electronics and gadgets',
      location: {
        address: '123 Tech Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001'
      },
      verified: true // Verified vendor
    });

    const vendor2 = await Vendor.create({
      userId: vendor2User._id,
      storeName: 'Fashion Forward',
      companyName: 'Fashion Forward Inc',
      description: 'Latest trends in fashion and accessories',
      location: {
        address: '456 Fashion Avenue',
        city: 'Delhi',
        state: 'Delhi',
        pincode: '110001'
      },
      verified: false // Unverified vendor
    });

    const vendor3 = await Vendor.create({
      userId: vendor3User._id,
      storeName: 'BookWorm Paradise',
      description: 'Books for every reader, from classics to contemporary',
      location: {
        address: '789 Library Road',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560001'
      },
      verified: false // Unverified vendor
    });

    console.log('Created vendor profiles');

    // Create product masters
    const products = [
      {
        name: 'iPhone 15 Pro',
        slug: 'iphone-15-pro',
        category: 'Electronics',
        description: 'Latest iPhone with advanced features'
      },
      {
        name: 'Samsung Galaxy S24',
        slug: 'samsung-galaxy-s24',
        category: 'Electronics',
        description: 'Flagship Android smartphone'
      },
      {
        name: 'MacBook Air M3',
        slug: 'macbook-air-m3',
        category: 'Electronics',
        description: 'Lightweight laptop with M3 chip'
      },
      {
        name: 'Casual T-Shirt',
        slug: 'casual-t-shirt',
        category: 'Fashion',
        description: 'Comfortable cotton t-shirt'
      },
      {
        name: 'Denim Jeans',
        slug: 'denim-jeans',
        category: 'Fashion',
        description: 'Classic blue denim jeans'
      },
      {
        name: 'The Great Gatsby',
        slug: 'the-great-gatsby',
        category: 'Books',
        description: 'Classic American novel by F. Scott Fitzgerald'
      },
      {
        name: 'To Kill a Mockingbird',
        slug: 'to-kill-a-mockingbird',
        category: 'Books',
        description: 'Pulitzer Prize-winning novel by Harper Lee'
      },
      {
        name: 'Organic Bananas',
        slug: 'organic-bananas',
        category: 'Grocery',
        description: 'Fresh organic bananas - 1kg pack'
      },
      {
        name: 'Whole Wheat Bread',
        slug: 'whole-wheat-bread',
        category: 'Grocery',
        description: 'Freshly baked whole wheat bread loaf'
      },
      {
        name: 'Fresh Milk',
        slug: 'fresh-milk',
        category: 'Grocery',
        description: 'Farm fresh full cream milk - 1 liter'
      }
    ];

    const createdProducts = await ProductMaster.insertMany(products);
    console.log('Created product masters');

    // Create vendor products (only for verified vendor)
    const vendorProducts = [
      {
        vendorId: vendor1._id,
        productId: createdProducts[0]._id, // iPhone 15 Pro
        price: 99999,
        stock: 10,
        companyName: 'TechHub Pvt Ltd'
      },
      {
        vendorId: vendor1._id,
        productId: createdProducts[1]._id, // Samsung Galaxy S24
        price: 79999,
        stock: 15,
        companyName: 'TechHub Pvt Ltd'
      },
      {
        vendorId: vendor1._id,
        productId: createdProducts[2]._id, // MacBook Air M3
        price: 114900,
        stock: 5,
        companyName: 'TechHub Pvt Ltd'
      },
      {
        vendorId: vendor1._id,
        productId: createdProducts[7]._id, // Organic Bananas
        price: 120,
        stock: 50,
        companyName: 'TechHub Pvt Ltd'
      },
      {
        vendorId: vendor1._id,
        productId: createdProducts[8]._id, // Whole Wheat Bread
        price: 45,
        stock: 25,
        companyName: 'TechHub Pvt Ltd'
      },
      {
        vendorId: vendor1._id,
        productId: createdProducts[9]._id, // Fresh Milk
        price: 65,
        stock: 30,
        companyName: 'TechHub Pvt Ltd'
      }
    ];

    await VendorProduct.insertMany(vendorProducts);
    console.log('Created vendor products');

    console.log('\n=== SEED DATA SUMMARY ===');
    console.log('Admin Users:');
    console.log('- admin@riztoo.test / admin123');
    console.log('- superadmin@riztoo.test / admin123');
    console.log('\nCustomer Users:');
    console.log('- customer@test.com / customer123');
    console.log('- jane@test.com / customer123');
    console.log('\nVendor Users:');
    console.log('- vendor@test.com / vendor123 (VERIFIED)');
    console.log('- fashion@test.com / vendor123 (UNVERIFIED)');
    console.log('- books@test.com / vendor123 (UNVERIFIED)');
    console.log('\nProducts: 10 product masters created (Electronics, Fashion, Books, Grocery)');
    console.log('Vendor Products: 6 products from TechHub Electronics (including grocery items)');
    console.log('\nDatabase seeded successfully!');

  } catch (error) {
    console.error('Seed error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;