import PostDB from './data/posts';
import AuthorDB from './data/authors';
import GroupDB from './data/groups';
import CommentDB from './data/comments';

import {
  GraphQLList,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  GraphQLInt,
  GraphQLEnumType,
  GraphQLNonNull,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLInputObjectType
} from 'graphql';

const handlePaginationArgs = ({beforeCursor, afterCursor, first, last}, keys) => {
  let arrayPartial;
  if (first) {
    const startingIdx = keys.indexOf(afterCursor) + 1;
    arrayPartial = keys.slice(startingIdx, startingIdx + first);
  } else if (last) {
    let endingIdx = keys.indexOf(beforeCursor) - 1;
    endingIdx = endingIdx === -2 ? keys.length : endingIdx;
    arrayPartial = keys.slice(endingIdx - last, endingIdx);
  } else {
    arrayPartial = keys;
  }
  return arrayPartial.map(key => CommentDB[key]);
};

const CategoryType = new GraphQLEnumType({
  name: "CategoryType",
  description: "A CategoryType of the blog",
  values: {
    HOT_STUFF: {value: "hot stuff"},
    ICE_COLD: {value: "ice cold"}
  }
});

const AuthorType = new GraphQLObjectType({
  name: "AuthorType",
  description: "Represent the type of an author of a blog post or a comment",
  fields: () => ({
    _id: {type: GraphQLString},
    name: {type: GraphQLString},
    twitterHandle: {type: GraphQLString}
  })
});

const HasAuthorType = new GraphQLInterfaceType({
  name: "HasAuthorType",
  description: "This type has an author",
  fields: () => ({
    author: {type: AuthorType}
  }),
  resolveType: (obj) => {
    if (obj.title) {
      return PostType;
    } else if (obj.replies) {
      return CommentType;
    }
  }
});

const CommentType = new GraphQLObjectType({
  name: "CommentType",
  interfaces: [HasAuthorType],
  description: "Represent the type of a comment",
  fields: () => ({
    _id: {type: GraphQLString},
    content: {type: GraphQLString},
    author: {
      type: AuthorType,
      resolve: function ({author}) {
        return AuthorDB[author];
      }
    },
    createdAt: {type: GraphQLInt},
    cursor: {
      type: GraphQLString,
      resolve(source) {
        return source._id
      }
    }
  })
});

const GroupType = new GraphQLObjectType({
  name: "Group",
  description: "A group with an owner and members",
  args: {
    groupId: {type: GraphQLString}
  },
  fields: () => ({
    _id: {type: GraphQLString},
    owner: {
      type: MemberType,
      resolve(source) {
        return AuthorDB[source.ownerId] || GroupDB[source.ownerId];
      }
    },
    members: {
      type: new GraphQLList(MemberType),
      resolve(source) {
        return source.members.map(member => {
          return AuthorDB[member] || GroupDB[member];
        });
      }
    }
  })
});

const MemberType = new GraphQLUnionType({
  name: "Member",
  resolveType(obj) {
    if (obj.hasOwnProperty('ownerId')) {
      return GroupType
    } else {
      return AuthorType;
    }
  },
  types: [GroupType, AuthorType]
});


const PostType = new GraphQLObjectType({
  name: "PostType",
  interfaces: [HasAuthorType],
  description: "Represent the type of a blog post",
  fields: () => ({
    _id: {type: GraphQLString},
    title: {
      type: GraphQLString,
      args: {
        language: {type: GraphQLString, description: "Language of the title"}
      },
      resolve(source, args) {
        if (args.language === 'spanish') {
          return source.title_ES;
        }
        return source.title;
      }
    },
    category: {type: CategoryType},
    content: {type: GraphQLString},
    createdAt: {type: GraphQLInt},
    comments: {
      type: new GraphQLList(CommentType),
      args: {
        beforeCursor: {type: GraphQLString, description: 'the cursor coming from the back'},
        afterCursor: {type: GraphQLString, description: 'the cursor coming from the front'},
        first: {type: GraphQLInt, description: "Limit the comments from the front"},
        last: {type: GraphQLInt, description: "Limit the comments from the back"}
      },
      resolve: function (post, args) {
        const keys = Object.keys(CommentDB);
        return handlePaginationArgs(args, keys)
      }
    },
    author: {
      type: AuthorType,
      resolve: function ({author}) {
        return AuthorDB[author];
      }
    },
    cursor: {
      type: GraphQLString,
      resolve(source) {
        return source.createdAt + 'chikachikow'
      }
    }
  })
});

const CreatePostMutationPayload = new GraphQLObjectType({
  name: "CreatePostMutationPayload",
  description: "Payload for creating a post",
  fields: () => ({
    post: {type: PostType},
    postCount: {type: GraphQLInt}
  })
});

const NewPost = new GraphQLInputObjectType({
  name: "NewPost",
  description: "input object for a new post",
  fields: () => ({
    _id: {type: new GraphQLNonNull(GraphQLString)},
    author: {type: GraphQLString},
    content: {type: GraphQLString},
    title: {type: GraphQLString},
    category: {type: GraphQLString}
  })
});

const Query = new GraphQLObjectType({
  name: 'BlogSchema',
  description: "Root of the Blog Schema",
  fields: () => ({
    getLatestPost: {
      type: PostType,
      description: "Latest post in the blog",
      resolve() {
        const keys = Object.keys(PostDB);
        const sortedKeys = keys.sort((a, b) => PostDB[b].createdAt - PostDB[a].createdAt);
        return PostDB[sortedKeys[0]];
      }
    },
    getRecentPosts: {
      type: new GraphQLList(PostType),
      description: "Recent posts in the blog",
      args: {
        beforeCursor: {type: GraphQLString, description: 'the cursor coming from the back'},
        afterCursor: {type: GraphQLString, description: 'the cursor coming from the front'},
        first: {type: GraphQLInt, description: "Limit the comments from the front"},
        last: {type: GraphQLInt, description: "Limit the comments from the back"}
      },
      resolve(source, args) {
        const postKeys = Object.keys(PostDB);
        const sortedKeys = postKeys.sort((a, b) => PostDB[b].createdAt - PostDB[a].createdAt);
        return handlePaginationArgs(args, sortedKeys);
      }
    },
    getPostById: {
      type: PostType,
      description: "PostType by _id",
      args: {
        _id: {type: new GraphQLNonNull(GraphQLString)}
      },
      resolve: function (source, {_id}) {
        return PostDB[_id];
      }
    },
    getGroup: {
      type: GroupType,
      args: {
        _id: {type: new GraphQLNonNull(GraphQLString)}
      },
      resolve(source, {_id}) {
        return GroupDB[_id]
      }
    }
  })
});

const Mutation = new GraphQLObjectType({
  name: "BlogMutations",
  fields: () => ({
    createPost: {
      type: CreatePostMutationPayload,
      description: "Create a post",
      args: {
        newPost: {type: new GraphQLNonNull(NewPost)}
      },
      resolve(source, {newPost}) {
        const post = Object.assign({}, newPost, {
          karma: 0,
          createdAt: Date.now(),
          title_ES: `${newPost.title} EN ESPANOL!`
        });
        PostDB[post._id] = post;
        return {
          post,
          postCount: Object.keys(PostDB).length
        }
      }
    },
    createComment: {
      type: CommentType,
      description: "Comment on a post",
      args: {
        _id: {type: new GraphQLNonNull(GraphQLString)},
        postId: {type: new GraphQLNonNull(GraphQLString)},
        content: {type: new GraphQLNonNull(GraphQLString)}
      },
      resolve(source, {content, postId, _id}) {
        const newPost = {
          _id,
          content,
          postId,
          karma: 0,
          author: 'a125',
          createdAt: Date.now()
        };
        CommentDB[_id] = newPost;
        return newPost;
      }
    }
  })
});

export default new GraphQLSchema({
  query: Query,
  mutation: Mutation
});
