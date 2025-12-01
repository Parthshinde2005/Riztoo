const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const User = require('../models/User');
const Vendor = require('../models/Vendor');
const ProductMaster = require('../models/ProductMaster');
const VendorProduct = require('../models/VendorProduct');
const Order = require('../models/Order');
const Review = require('../models/Review');

async function runBugFixes() {
  try {
    console.log('🔧 Starting Bug Fixes and Data Integrity Checks...\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    let issuesFixed = 0;

    // Fix 1: Remove orphaned vendor profiles (vendors without users)
    console.log('📋 Checking for orphaned vendor profiles...');
    const vendors = await Vendor.find().populate('userId');
    const orphanedVendors = vendors.filter(v => !v.userId);
    
    if (orphanedVendors.length > 0) {
      for (const vendor of orphanedVendors) {
        await Vendor.findByIdAndDelete(vendor._id);
        console.log(`  ❌ Removed orphaned vendor: ${vendor.storeName}`);
        issuesFixed++;
      }
    } else {
      console.log('  ✅ No orphaned vendor profiles found');
    }

    // Fix 2: Remove orphaned vendor products (products without vendors)
    console.log('\n📋 Checking for orphaned vendor products...');
    const vendorProducts = await VendorProduct.find();
    let orphanedProducts = 0;
    
    for (const vp of vendorProducts) {
      const vendorExists = await Vendor.findById(vp.vendorId);
      const productExists = await ProductMaster.findById(vp.productId);
      
      if (!vendorExists || !productExists) {
        await VendorProduct.findByIdAndDelete(vp._id);
        orphanedProducts++;
        issuesFixed++;
      }
    }
    
    if (orphanedProducts > 0) {
      console.log(`  ❌ Removed ${orphanedProducts} orphaned vendor products`);
    } else {
      console.log('  ✅ No orphaned vendor products found');
    }

    // Fix 3: Remove orphaned reviews (reviews without orders or products)
    console.log('\n📋 Checking for orphaned reviews...');
    const reviews = await Review.find();
    let orphanedReviews = 0;
    
    for (const review of reviews) {
      const orderExists = await Order.findById(review.orderId);
      const productExists = await ProductMaster.findById(review.productId);
      
      if (!orderExists || !productExists) {
        await Review.findByIdAndDelete(review._id);
        orphanedReviews++;
        issuesFixed++;
      }
    }
    
    if (orphanedReviews > 0) {
      console.log(`  ❌ Removed ${orphanedReviews} orphaned reviews`);
    } else {
      console.log('  ✅ No orphaned reviews found');
    }

    // Fix 4: Remove guest users older than 7 days
    console.log('\n📋 Checking for old guest users...');
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oldGuests = await User.deleteMany({
      isGuest: true,
      createdAt: { $lt: sevenDaysAgo }
    });
    
    if (oldGuests.deletedCount > 0) {
      console.log(`  ❌ Removed ${oldGuests.deletedCount} old guest users`);
      issuesFixed += oldGuests.deletedCount;
    } else {
      console.log('  ✅ No old guest users found');
    }

    // Fix 5: Ensure upload directories exist
    console.log('\n📋 Checking upload directories...');
    const uploadDirs = [
      path.join(__dirname, '../uploads'),
      path.join(__dirname, '../uploads/products'),
      path.join(__dirname, '../uploads/stores')
    ];
    
    let directoriesCreated = 0;
    for (const dir of uploadDirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`  ✅ Created directory: ${dir}`);
        directoriesCreated++;
        issuesFixed++;
      }
    }
    
    if (directoriesCreated === 0) {
      console.log('  ✅ All upload directories exist');
    }

    // Fix 6: Fix negative stock values
    console.log('\n📋 Checking for negative stock values...');
    const negativeStock = await VendorProduct.updateMany(
      { stock: { $lt: 0 } },
      { $set: { stock: 0 } }
    );
    
    if (negativeStock.modifiedCount > 0) {
      console.log(`  ❌ Fixed ${negativeStock.modifiedCount} products with negative stock`);
      issuesFixed += negativeStock.modifiedCount;
    } else {
      console.log('  ✅ No negative stock values found');
    }

    // Fix 7: Fix invalid price values
    console.log('\n📋 Checking for invalid price values...');
    const invalidPrices = await VendorProduct.find({
      $or: [
        { price: { $lte: 0 } },
        { price: null },
        { price: undefined }
      ]
    });
    
    if (invalidPrices.length > 0) {
      for (const product of invalidPrices) {
        await VendorProduct.findByIdAndUpdate(product._id, { price: 1 });
        console.log(`  ❌ Fixed invalid price for product: ${product._id}`);
        issuesFixed++;
      }
    } else {
      console.log('  ✅ No invalid price values found');
    }

    // Fix 8: Ensure all vendors have required fields
    console.log('\n📋 Checking vendor data integrity...');
    const vendorsWithoutStoreName = await Vendor.find({
      $or: [
        { storeName: null },
        { storeName: '' }
      ]
    }).populate('userId');
    
    if (vendorsWithoutStoreName.length > 0) {
      for (const vendor of vendorsWithoutStoreName) {
        const storeName = vendor.userId ? `${vendor.userId.name}'s Store` : 'Unnamed Store';
        await Vendor.findByIdAndUpdate(vendor._id, { storeName });
        console.log(`  ❌ Fixed missing store name for vendor: ${vendor._id}`);
        issuesFixed++;
      }
    } else {
      console.log('  ✅ All vendors have store names');
    }

    // Fix 9: Remove duplicate product masters (same slug)
    console.log('\n📋 Checking for duplicate product masters...');
    const duplicates = await ProductMaster.aggregate([
      { $group: { _id: '$slug', count: { $sum: 1 }, ids: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } }
    ]);
    
    if (duplicates.length > 0) {
      for (const dup of duplicates) {
        // Keep the first one, delete the rest
        const idsToDelete = dup.ids.slice(1);
        await ProductMaster.deleteMany({ _id: { $in: idsToDelete } });
        console.log(`  ❌ Removed ${idsToDelete.length} duplicate products with slug: ${dup._id}`);
        issuesFixed += idsToDelete.length;
      }
    } else {
      console.log('  ✅ No duplicate product masters found');
    }

    // Fix 10: Validate and fix order statuses
    console.log('\n📋 Checking order statuses...');
    const validStatuses = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];
    const invalidOrders = await Order.find({
      status: { $nin: validStatuses }
    });
    
    if (invalidOrders.length > 0) {
      for (const order of invalidOrders) {
        await Order.findByIdAndUpdate(order._id, { status: 'pending' });
        console.log(`  ❌ Fixed invalid status for order: ${order._id}`);
        issuesFixed++;
      }
    } else {
      console.log('  ✅ All orders have valid statuses');
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('🎯 Bug Fix Summary');
    console.log('='.repeat(50));
    console.log(`Total issues fixed: ${issuesFixed}`);
    
    if (issuesFixed === 0) {
      console.log('✅ No issues found! Database is healthy.');
    } else {
      console.log('✅ All issues have been resolved.');
    }
    
    console.log('\n💡 Recommendations:');
    console.log('  - Run this script periodically to maintain data integrity');
    console.log('  - Monitor logs for any recurring issues');
    console.log('  - Keep backups of your database');

  } catch (error) {
    console.error('\n❌ Error during bug fixes:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

// Run if called directly
if (require.main === module) {
  runBugFixes();
}

module.exports = runBugFixes;
