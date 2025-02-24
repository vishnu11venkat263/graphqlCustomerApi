const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: String,
  _id: String,
  category : String,
  price : Number,
  stock : Number
});

const orderSchema = new mongoose.Schema({
  customerId: String,
  productId: String,
  quantity: Number,
  totalAmount:Number,
  
  orderDate: Date,
});

const Product = mongoose.model("products", productSchema);
const Order = mongoose.model("orders", orderSchema);

module.exports = { Product, Order };
