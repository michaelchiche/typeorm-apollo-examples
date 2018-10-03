import 'reflect-metadata';
import {
  createConnection,
  getRepository,
  In,
  createQueryBuilder,
} from 'typeorm';
import { User } from './entity/User';
import { Post } from './entity/Post';
import { Tag } from './entity/Tag';
import { ApolloServer, gql, PubSub } from 'apollo-server';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import * as Redis from 'ioredis';

const options = {
  host: '127.0.0.1',
  port: 6379,
  retry_strategy: options => {
    // reconnect after
    return Math.max(options.attempt * 100, 3000);
  },
};

const pubsub = new RedisPubSub({
  publisher: new Redis(options),
  subscriber: new Redis(options),
});
5;
// const pubsub = new PubSub();
const POST_ADDED = 'POST_ADDED';

createConnection()
  .then(async connection => {
    const userRepository = getRepository(User);
    const postRepository = getRepository(Post);
    const tagRepository = getRepository(Tag);

    // Type definitions define the "shape" of your data and specify
    // which ways the data can be fetched from the GraphQL server.
    const typeDefs = gql`
      # Comments in GraphQL are defined with the hash (#) symbol.

      # This "Book" type can be used in other type declarations.
      type User {
        id: ID
        firstName: String
        lastName: String
        age: Int
        posts: [Post]
      }

      type Post {
        id: ID
        title: String
        content: String
        author: User
        tags: [Tag]
      }

      type Tag {
        id: ID
        name: String
        posts: [Post]
      }

      # The "Query" type is the root of all GraphQL queries.
      # (A "Mutation" type will be covered later on.)
      type Query {
        authors: [User]
        authorsWithPosts: [User]
        author(id: ID): User
        posts: [Post]
        tags: [Tag]
      }

      input createPostInput {
        title: String!
        content: String!
        authorId: Int!
        tags: [Int]!
      }

      type Mutation {
        createPost(post: createPostInput): Post
      }

      type Subscription {
        postAdded: Post
      }
    `;

    // Resolvers define the technique for fetching the types in the
    // schema.  We'll retrieve books from the "books" array above.
    const resolvers = {
      Query: {
        authors: () => userRepository.find(),
        author: (_, { id }) => userRepository.findOne(id),
        posts: () => postRepository.find(),
        tags: () => tagRepository.find(),
        authorsWithPosts: async () => {
          const query = userRepository
            .createQueryBuilder('user')
            // .leftJoinAndSelect('user.posts', 'post');
            .leftJoinAndSelect(Post, 'post', '`post`.`authorId`=`user`.`id`');

          const authorsWithPosts = await query.getMany();

          console.log('query:', query.getSql());
          console.log('posts:', authorsWithPosts[0]);

          return userRepository
            .createQueryBuilder('user')
            .leftJoinAndSelect('user.posts', 'post')
            .getMany();
        },
      },
      Mutation: {
        async createPost(parent, { post }, context, info) {
          const author = await userRepository.findOne(post.authorId);

          if (!author) {
            return null;
          }

          const tags = await tagRepository.find({
            where: {
              id: In(post.tags),
            },
          });

          const p = postRepository.create({
            content: post.content,
            title: post.title,
            author,
            tags,
          });

          const postSaved = await postRepository.save(p);

          console.log(postSaved);

          pubsub.publish(POST_ADDED, {
            postAdded: postSaved,
          });

          return postSaved;
        },
      },
      Subscription: {
        postAdded: {
          subscribe: () => pubsub.asyncIterator(POST_ADDED),
        },
      },
      User: {
        posts(parent: User, args, context, info) {
          return postRepository.find({
            where: {
              author: {
                id: parent.id,
              },
            },
          });
        },
      },
      Post: {
        async author(parent: Post, args, context, info) {
          const post = await postRepository.findOne(parent.id, {
            relations: ['author'],
          });

          return post.author;
        },
        async tags(parent: Post, args, context, info) {
          return tagRepository.find({
            where: {
              posts: [parent],
            },
          });
        },
      },
      Tag: {
        async posts(parent: Tag, args, context, info) {
          return postRepository.find({
            where: {
              id: In(parent.posts),
            },
          });
        },
      },
    };

    // In the most basic sense, the ApolloServer can be started
    // by passing type definitions (typeDefs) and the resolvers
    // responsible for fetching the data for those types.
    const server = new ApolloServer({ typeDefs, resolvers });

    // This `listen` method launches a web-server.  Existing apps
    // can utilize middleware options, which we'll discuss later.
    server.listen().then(({ url }) => {
      console.log(`🚀  Server ready at ${url}`);
    });
  })
  .catch(error => console.log(error));
