const { Order, Product } = require("./models");
const redis = require("redis");





const client = redis.createClient({
  socket: { host: "127.0.0.1", port: 6379 },
  
});
client.connect().catch(console.error);

const resolvers = {
  Query: {
    
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
          $unwind: "$products", 
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
            from: "products", 
            localField: "_id",
            foreignField: "_id",
            as: "productDetails",
          },
        },
        {
          $unwind: {
            path: "$productDetails",
            preserveNullAndEmptyArrays: true,
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
        { $unwind: "$products" }, 
        {
          $lookup: {
            from: "products",
            localField: "products.productId",
            foreignField: "_id",
            as: "productDetails",
          },
        },
        { $unwind: "$productDetails" }, 
        {
          $group: {
            _id: "$productDetails.category",
            totalRevenue: {
              $sum: { $multiply: ["$products.priceAtPurchase", "$products.quantity"] },
            },
            totalOrders: { $sum: 1 },
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
    
    
      await client.setEx(cacheKey, 600, JSON.stringify(response));
    
      return response;
    }
    
  },
};

module.exports = resolvers;
