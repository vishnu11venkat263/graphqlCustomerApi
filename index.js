const express = require("express");
const { ApolloServer } = require("apollo-server-express");
const mongoose = require("mongoose");
const typeDefs = require("./src/schema.js");
const resolvers = require("./src/resolvers.js");


const startServer = async () => {
  const app = express();

  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();
  server.applyMiddleware({ app });

  await mongoose.connect("mongodb://localhost:27017/customerDB", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  app.listen(4000, () => {
    console.log("🚀 Server running at http://localhost:4000/graphql");
  });


 

};

startServer();
