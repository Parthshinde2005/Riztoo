const mongoose = require('mongoose');
require('dotenv').config();

const ProductMaster = require('../models/ProductMaster');
const VendorProduct = require('../models/VendorProduct');
const Order = require('../models/Order');
const Review = require('../models/Review');

async function clearProducts() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Count existing data
    const productMasterCount = await ProductMaster.countDocuments();
    const vendorProductCount = await VendorProduct.countDocuments();
    const orderCount = await Order.countDocuments();
    const reviewCount = await Review.countDocuments();

    console.log('\n=== CURRENT DATA ===');
    console.log(`Product Masters: ${productMasterCount}`);
    console.log(`Vendor Products: ${vendorProductCount}`);
    console.log(`Orders: ${orderCount}`);
    console.log(`Reviews: ${reviewCount}`);

    // Clear products
    console.log('\n🗑️  Removing all products...');
    
    await VendorProduct.deleteMany({});
    console.log('✅ Cleared all vendor products');
    
    await ProductMaster.deleteMany({});
    console.log('✅ Cleared all product masters');
    
    await Order.deleteMany({});
    console.log('✅ Cleared all orders');
    
    await Review.deleteMany({});
    console.log('✅ Cleared all reviews');

    console.log('\n=== CLEANUP COMPLETE ===');
    console.log('All products, orders, and reviews have been removed from the database.');
    console.log('Users and vendors remain intact.');

  } catch (error) {
    console.error('❌ Error clearing products:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run if called directly
if (require.main === module) {
  clearProducts();
}

module.exports = clearProducts;
