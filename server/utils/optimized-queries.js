const mongoose = require('mongoose');

// Optimized query utilities to reduce database load
class OptimizedQueries {
  
  // Optimized product listing with vendor data
  static async getProductsWithVendors(filters = {}, options = {}) {
    const { page = 1, limit = 20, category, search, vendorId } = options;
    const skip = (page - 1) * limit;

    // Build match conditions
    const matchConditions = {};
    if (category) matchConditions.category = new RegExp(category, 'i');
    if (search) matchConditions.name = new RegExp(search, 'i');

    // Single aggregation pipeline for better performance
    const pipeline = [
      { $match: matchConditions },
      {
        $lookup: {
          from: 'vendorproducts',
          let: { productId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$productId', '$$productId'] },
                ...(vendorId && { vendorId: mongoose.Types.ObjectId(vendorId) }),
                isActive: true
              }
            },
            {
              $lookup: {
                from: 'vendors',
                localField: 'vendorId',
                foreignField: '_id',
                as: 'vendor',
                pipeline: [{ $project: { storeName: 1, companyName: 1, verified: 1 } }]
              }
            },
            { $unwind: '$vendor' },
            {
              $project: {
                _id: 1,
                price: 1,
                stock: 1,
                images: 1,
                vendor: 1
              }
            }
          ],
          as: 'vendorProducts'
        }
      },
      {
        $match: {
          'vendorProducts.0': { $exists: true } // Only products with vendors
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          category: 1,
          description: 1,
          images: 1,
          vendorProducts: 1,
          createdAt: 1
        }
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit }
    ];

    return await mongoose.model('ProductMaster').aggregate(pipeline);
  }

  // Optimized vendor dashboard data
  static async getVendorDashboardData(vendorId) {
    const pipeline = [
      { $match: { _id: vendorId } },
      {
        $lookup: {
          from: 'vendorproducts',
          localField: '_id',
          foreignField: 'vendorId',
          as: 'products'
        }
      },
      {
        $lookup: {
          from: 'orders',
          let: { vendorId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ['$$vendorId', '$items.vendorId']
                },
                status: { $ne: 'pending' }
              }
            },
            {
              $project: {
                totalAmount: 1,
                status: 1,
                createdAt: 1,
                items: {
                  $filter: {
                    input: '$items',
                    cond: { $eq: ['$$this.vendorId', '$$vendorId'] }
                  }
                }
              }
            }
          ],
          as: 'orders'
        }
      },
      {
        $lookup: {
          from: 'reviews',
          localField: '_id',
          foreignField: 'vendorId',
          as: 'reviews'
        }
      },
      {
        $project: {
          storeName: 1,
          companyName: 1,
          description: 1,
          verified: 1,
          totalProducts: { $size: '$products' },
          totalOrders: { $size: '$orders' },
          totalRevenue: {
            $sum: {
              $map: {
                input: '$orders',
                as: 'order',
                in: {
                  $sum: {
                    $map: {
                      input: '$$order.items',
                      as: 'item',
                      in: { $multiply: ['$$item.price', '$$item.qty'] }
                    }
                  }
                }
              }
            }
          },
          averageRating: { $avg: '$reviews.rating' },
          totalReviews: { $size: '$reviews' }
        }
      }
    ];

    const result = await mongoose.model('Vendor').aggregate(pipeline);
    return result[0] || null;
  }

  // Optimized order history with pagination
  static async getUserOrderHistory(userId, options = {}) {
    const { page = 1, limit = 10 } = options;
    const skip = (page - 1) * limit;

    const pipeline = [
      { $match: { userId: mongoose.Types.ObjectId(userId) } },
      {
        $lookup: {
          from: 'vendorproducts',
          localField: 'items.vendorProductId',
          foreignField: '_id',
          as: 'vendorProductDetails'
        }
      },
      {
        $lookup: {
          from: 'productmasters',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      {
        $lookup: {
          from: 'vendors',
          localField: 'items.vendorId',
          foreignField: '_id',
          as: 'vendorDetails'
        }
      },
      {
        $addFields: {
          items: {
            $map: {
              input: '$items',
              as: 'item',
              in: {
                $mergeObjects: [
                  '$$item',
                  {
                    productName: {
                      $arrayElemAt: [
                        {
                          $map: {
                            input: {
                              $filter: {
                                input: '$productDetails',
                                cond: { $eq: ['$$this._id', '$$item.productId'] }
                              }
                            },
                            in: '$$this.name'
                          }
                        },
                        0
                      ]
                    },
                    storeName: {
                      $arrayElemAt: [
                        {
                          $map: {
                            input: {
                              $filter: {
                                input: '$vendorDetails',
                                cond: { $eq: ['$$this._id', '$$item.vendorId'] }
                              }
                            },
                            in: '$$this.storeName'
                          }
                        },
                        0
                      ]
                    }
                  }
                ]
              }
            }
          }
        }
      },
      {
        $project: {
          _id: 1,
          totalAmount: 1,
          status: 1,
          createdAt: 1,
          paidAt: 1,
          items: 1
        }
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit }
    ];

    return await mongoose.model('Order').aggregate(pipeline);
  }

  // Optimized product reviews with statistics
  static async getProductReviews(productId, options = {}) {
    const { page = 1, limit = 10, sortBy = 'createdAt', rating } = options;
    const skip = (page - 1) * limit;

    const matchConditions = { productId: mongoose.Types.ObjectId(productId) };
    if (rating) matchConditions.rating = parseInt(rating);

    const pipeline = [
      { $match: matchConditions },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
          pipeline: [{ $project: { name: 1 } }]
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          rating: 1,
          comment: 1,
          createdAt: 1,
          isVerified: 1,
          helpfulCount: 1,
          userName: '$user.name'
        }
      },
      { $sort: { [sortBy]: -1 } },
      { $skip: skip },
      { $limit: limit }
    ];

    // Get reviews and statistics in parallel
    const [reviews, stats] = await Promise.all([
      mongoose.model('Review').aggregate(pipeline),
      mongoose.model('Review').aggregate([
        { $match: { productId: mongoose.Types.ObjectId(productId) } },
        {
          $group: {
            _id: null,
            totalReviews: { $sum: 1 },
            averageRating: { $avg: '$rating' },
            ratingDistribution: {
              $push: '$rating'
            }
          }
        },
        {
          $project: {
            totalReviews: 1,
            averageRating: { $round: ['$averageRating', 1] },
            ratingCounts: {
              $arrayToObject: {
                $map: {
                  input: [1, 2, 3, 4, 5],
                  as: 'rating',
                  in: {
                    k: { $toString: '$$rating' },
                    v: {
                      $size: {
                        $filter: {
                          input: '$ratingDistribution',
                          cond: { $eq: ['$$this', '$$rating'] }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      ])
    ]);

    return {
      reviews,
      statistics: stats[0] || { totalReviews: 0, averageRating: 0, ratingCounts: {} }
    };
  }

  // Optimized vendor earnings calculation
  static async getVendorEarnings(vendorId, options = {}) {
    const { startDate, endDate } = options;
    
    const matchConditions = {
      'items.vendorId': mongoose.Types.ObjectId(vendorId),
      status: 'paid'
    };

    if (startDate || endDate) {
      matchConditions.paidAt = {};
      if (startDate) matchConditions.paidAt.$gte = new Date(startDate);
      if (endDate) matchConditions.paidAt.$lte = new Date(endDate);
    }

    const pipeline = [
      { $match: matchConditions },
      { $unwind: '$items' },
      { $match: { 'items.vendorId': mongoose.Types.ObjectId(vendorId) } },
      {
        $group: {
          _id: null,
          totalSales: { $sum: { $multiply: ['$items.price', '$items.qty'] } },
          totalOrders: { $sum: 1 },
          ordersByMonth: {
            $push: {
              month: { $dateToString: { format: '%Y-%m', date: '$paidAt' } },
              amount: { $multiply: ['$items.price', '$items.qty'] }
            }
          }
        }
      },
      {
        $project: {
          totalSales: 1,
          totalOrders: 1,
          commission: { $multiply: ['$totalSales', 0.01] }, // 1% commission
          netEarnings: { $multiply: ['$totalSales', 0.99] }, // 99% to vendor
          monthlyBreakdown: {
            $arrayToObject: {
              $map: {
                input: {
                  $setUnion: {
                    $map: {
                      input: '$ordersByMonth',
                      in: '$$this.month'
                    }
                  }
                },
                as: 'month',
                in: {
                  k: '$$month',
                  v: {
                    $sum: {
                      $map: {
                        input: {
                          $filter: {
                            input: '$ordersByMonth',
                            cond: { $eq: ['$$this.month', '$$month'] }
                          }
                        },
                        in: '$$this.amount'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    ];

    const result = await mongoose.model('Order').aggregate(pipeline);
    return result[0] || {
      totalSales: 0,
      totalOrders: 0,
      commission: 0,
      netEarnings: 0,
      monthlyBreakdown: {}
    };
  }
}

module.exports = OptimizedQueries;