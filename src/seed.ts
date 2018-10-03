import 'reflect-metadata';
import { createConnection, getRepository } from 'typeorm';
import { User } from './entity/User';
import { Tag } from './entity/Tag';
import { Post } from './entity/Post';

createConnection({
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  username: 'test',
  password: 'test',
  database: 'test',
  synchronize: true,
  logging: false,
  entities: ['src/entity/**/*.ts'],
  migrations: ['src/migration/**/*.ts'],
  subscribers: ['src/subscriber/**/*.ts'],
  cli: {
    entitiesDir: 'src/entity',
    migrationsDir: 'src/migration',
    subscribersDir: 'src/subscriber',
  },
})
  .then(async connection => {
    const tag = getRepository(Tag);
    const tags = tag.create([
      {
        name: 'tag1',
      },
      {
        name: 'tag2',
      },
    ]);

    const user = getRepository(User);
    const users = user.create([
      {
        firstName: 'firstname-1',
        lastName: 'lastname-1',
        age: 30,
      },
      {
        firstName: 'firstname-2',
        lastName: 'lastname-2',
        age: 28,
      },
      {
        firstName: 'firstname-3',
        lastName: 'lastname-3',
        age: 22,
      },
    ]);

    await tag.save(tags);
    await user.save(users);

    const post = getRepository(Post);

    const posts = post.create([
      {
        author: users[1],
        tags: tags,
        title: 'test',
        content: 'life is good!',
      },
    ]);

    await post.save(posts);
  })
  .catch(error => console.log(error));
