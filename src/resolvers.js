const { Order, Product } = require("./models");
const redis = require("redis");





const client = redis.createClient({
  socket: { host: "127.0.0.1", port: 6379 },
  
});
client.connect().catch(console.error);

const resolvers = {
  Query: {
    // getCustomerSpending: async (_, { customerId }) => {
    //   const orders = await Order.find({ customerId });

    //   if (orders.length === 0) {
    //     return {
    //       customerId,
    //       totalSpent: 0,
    //       averageOrderValue: 0,
    //       lastOrderDate: null,
    //     };
    //   }


    //   const totalSpent = Math.round(
    //     orders.reduce((sum, order) => sum + order.totalAmount, 0) * 100
    //   ) / 100;
      
    //   const averageOrderValue =
    //     orders.length > 0 ? Math.round((totalSpent / orders.length) * 100) / 100 : 0;
    //   const lastOrderDate = orders
    //     .map((order) => order.orderDate)
    //     .sort((a, b) => b - a)[0];

    //   return {
    //     customerId,
    //     totalSpent,
    //     averageOrderValue,
    //     lastOrderDate: lastOrderDate ? lastOrderDate.toISOString() : null,
    //   };
    // },

    getCustomerSpending: async (_, { customerId }) => {

      const cacheKey = `customer_spending:${customerId}`;
      const cachedData = await client.get(cacheKey);
      if (cachedData) {
        console.log("Returning cached data");
        return JSON.parse(cachedData);
      }
      console.log("Fetching fresh data from MongoDB");
      const result = await Order.aggregate([
        { $match: { customerId } }, 
        {
          $group: {
            _id: "$customerId",
            totalSpent: { $sum: "$totalAmount" },
            averageOrderValue: { $avg: "$totalAmount" },
            lastOrderDate: { $max: "$orderDate" },
          },
        },
      ]);
    
      if (result.length === 0) {
        return {
          customerId,
          totalSpent: 0,
          averageOrderValue: 0,
          lastOrderDate: null,
        };
      }
    
      const { totalSpent, averageOrderValue, lastOrderDate } = result[0];
      const response = {
        customerId,
        totalSpent: Math.round(totalSpent * 100) / 100,
        averageOrderValue: Math.round(averageOrderValue * 100) / 100,
        lastOrderDate: lastOrderDate ? new Date(lastOrderDate).toISOString() : null,
      };
      await client.setEx(cacheKey, 600, JSON.stringify(response));
      return response;
    },
    
    // getTopSellingProducts: async (_, { limit }) => {
    //   const productSales = await Order.aggregate([
    //     {
    //       $group: {
    //         _id: null,
    //         products: { $push: "$products" },
    //       },
    //     },
    //     {
    //       $project: {
    //         _id: 0,
    //         productQuantities: {
    //           $reduce: {
    //             input: "$products",
    //             initialValue: [],
    //             in: {
    //               $concatArrays: ["$$value", "$$this"],
    //             },
    //           },
    //         },
    //       },
    //     },
    //     {
    //       $unwind: "$productQuantities",
    //     },
    //     {
    //       $group: {
    //         _id: "$productQuantities.productId",
    //         totalSold: { $sum: "$productQuantities.quantity" },
    //       },
    //     },
    //     {
    //       $sort: { totalSold: -1 },
    //     },
    //     {
    //       $limit: limit,
    //     },
    //   ]);

    //   return Promise.all(
    //     productSales.map(async ({ _id, totalSold }) => {
    //       const product = await Product.findById(_id);
    //       return {
    //         productId: _id,
    //         name: product ? product.name : "Unknown Product",
    //         totalSold,
    //       };
    //     })
    //   );
    // },


    getTopSellingProducts: async (_, { limit }) => {


      const cacheKey = `top_selling:${limit}`;
      const cachedData = await client.get(cacheKey);
      if (cachedData) {
        console.log("Returning cached data");
        return JSON.parse(cachedData);
      }
      console.log("Fetching fresh data from MongoDB");
      const productSales = await Order.aggregate([
        {
          $unwind: "$products", // Directly unwind products array
        },
        {
          $group: {
            _id: "$products.productId",
            totalSold: { $sum: "$products.quantity" },
          },
        },
        {
          $sort: { totalSold: -1 },
        },
        {
          $limit: limit,
        },
        {
          $lookup: {
            from: "products", // Ensure this matches the collection name
            localField: "_id",
            foreignField: "_id",
            as: "productDetails",
          },
        },
        {
          $unwind: {
            path: "$productDetails",
            preserveNullAndEmptyArrays: true, // Handle cases where product details are missing
          },
        },
        {
          $project: {
            productId: "$_id",
            name: { $ifNull: ["$productDetails.name", "Unknown Product"] },
            totalSold: 1,
          },
        },
      ]);
      await client.setEx(cacheKey, 600, JSON.stringify(productSales));
      return productSales;
    },
    
    // getSalesAnalytics: async (_, { startDate, endDate }) => {
    //   const start = new Date(startDate);
    //   const end = new Date(endDate);

    //   // Fetch completed orders within the date range
    //   const orders = await Order.find({
    //     status: "completed",
    //     $expr: {
    //       $and: [
    //         { $gte: [{ $toDate: "$orderDate" }, start] },
    //         { $lte: [{ $toDate: "$orderDate" }, end] },
    //       ],
    //     },
    //   });

    //   if (orders.length === 0) {
    //     return {
    //       totalRevenue: 0,
    //       completedOrders: 0,
    //       categoryBreakdown: [],
    //     };
    //   }

    //   const totalRevenue = orders.reduce(
    //     (sum, order) => sum + order.totalAmount,
    //     0
    //   );

    //   const completedOrders = orders.length;

    //   // Aggregate revenue by category
    //   const categorySales = await Order.aggregate([
    //     {
    //       $match: {
    //         status: "completed",
    //         $expr: {
    //           $and: [
    //             { $gte: [{ $toDate: "$orderDate" }, start] },
    //             { $lte: [{ $toDate: "$orderDate" }, end] },
    //           ],
    //         },
    //       },
    //     },
    //     { $unwind: "$products" },
    //     {
    //       $lookup: {
    //         from: "products",
    //         let: {
    //           priceAtPurchase: "$products.priceAtPurchase",
    //           quantity: "$products.quantity",
    //           productId: "$products.productId",
    //         },
    //         pipeline: [
    //           {
    //             $match: {
    //               $expr: { $eq: ["$_id", "$$productId"] },
    //             },
    //           },
    //           {
    //             $project: {
    //               _id: 0,
    //               category: 1,
    //               name: 1,
    //               priceAtPurchase: "$$priceAtPurchase",
    //               quantity: "$$quantity",
    //             },
    //           },
    //         ],
    //         as: "product",
    //       },
    //     },

    //     { $unwind: "$product" },
    //     {
    //       $group: {
    //         _id: "$product.category",
    //         totalRevenue: {
    //           $sum: {
    //             $multiply: ["$product.priceAtPurchase", "$product.quantity"],
    //           },
    //         },
    //       },
    //     },
    //     {
    //       $project: {
    //         revenue: { $round: [{ $toDouble: "$totalRevenue" }, 2] },
    //       },
    //     },
    //     { $sort: { revenue: -1 } },
    //   ]);

    //   console.log("categorySales", categorySales);

    //   const categoryBreakdown = categorySales.map((c) => ({
    //     category: c._id || "Uncategorized",
    //     revenue: c.revenue,
    //   }));

    //   return {
    //     totalRevenue,
    //     completedOrders,
    //     categoryBreakdown,
    //   };
    // },

    getSalesAnalytics: async (_, { startDate, endDate }) => {
      const start = new Date(startDate);
      const end = new Date(endDate);

      
      const cacheKey = `sales_analytics:${startDate}_${endDate}`;


      const cachedData = await client.get(cacheKey);
      if (cachedData) {
        console.log("Returning cached data");
        return JSON.parse(cachedData);
      }
    
      console.log("Fetching fresh data from MongoDB");
      const salesData = await Order.aggregate([
        {
          $match: {
            status: "completed",
            $expr: {
                    $and: [
                      { $gte: [{ $toDate: "$orderDate" }, start] },
                      { $lte: [{ $toDate: "$orderDate" }, end] },
                    ],
                  },
          },
        },
        { $unwind: "$products" }, // Flatten products array
        {
          $lookup: {
            from: "products",
            localField: "products.productId",
            foreignField: "_id",
            as: "productDetails",
          },
        },
        { $unwind: "$productDetails" }, // Get actual product data
        {
          $group: {
            _id: "$productDetails.category",
            totalRevenue: {
              $sum: { $multiply: ["$products.priceAtPurchase", "$products.quantity"] },
            },
            totalOrders: { $sum: 1 }, // Count number of orders
          },
        },
        {
          $project: {
            _id: 0,
            category: { $ifNull: ["$_id", "Uncategorized"] },
            revenue: { $round: ["$totalRevenue", 2] },
          },
        },
        { $sort: { revenue: -1 } },
      ]);
    
      // Calculate overall revenue & completed orders
      const totalRevenue = salesData.reduce((sum, entry) => sum + entry.revenue, 0);
      const completedOrders = await Order.countDocuments({
        status: "completed",
        $expr: {
          $and: [
            { $gte: [{ $toDate: "$orderDate" }, start] },
            { $lte: [{ $toDate: "$orderDate" }, end] },
          ],
        },
      });
    
      const response = {
        totalRevenue,
        completedOrders,
        categoryBreakdown: salesData,
      };
    
      // Store the result in Redis with a TTL (e.g., 10 minutes)
      await client.setEx(cacheKey, 600, JSON.stringify(response));
    
      return response;
    }
    
  },
};

module.exports = resolvers;
