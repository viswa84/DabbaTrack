const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const cors = require('cors');
const { typeDefs, resolvers } = require('./schema');
const { authMiddleware } = require('./auth');


async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(authMiddleware);

  const apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }) => ({ user: req.user }),
  });

  await apolloServer.start();
  apolloServer.applyMiddleware({ app, path: '/graphql' });

  app.get('/', (_req, res) => {
    res.json({
      name: 'DabbaTrack API by vishwanth Gouda',
      description: 'GraphQL API for dabba (tiffin), attendance, and billing',
      graphqlPath: '/graphql',
      version :"0.2",
    });
  });

  const port = process.env.PORT || 4000;
  app.listen(port, () => {
    console.log(`DabbaTrack GraphQL server running at http://localhost:${port}/graphql`);
  });
}

startServer();
