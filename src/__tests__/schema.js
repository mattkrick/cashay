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
  GraphQLInputObjectType,
  GraphQLBoolean,
  GraphQLFloat
} from 'graphql';

const handlePaginationArgs = ({beforeCursor, afterCursor, first, last}, objs) => {
  let arrayPartial;
  if (first) {
    const docsToSend = first + 1;
    const startingIdx = objs.findIndex(obj => obj.cursor === afterCursor) + 1;
    arrayPartial = objs.slice(startingIdx, startingIdx + docsToSend);
  } else if (last) {
    const docsToSend = last + 1;
    let endingIdx = objs.findIndex(obj => obj.cursor === beforeCursor);
    endingIdx = endingIdx === -1 ? objs.length : endingIdx;
    const start = Math.max(0, endingIdx - docsToSend);
    arrayPartial = objs.slice(start, endingIdx);
  } else {
    arrayPartial = objs;
  }
  return arrayPartial;
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
      resolve: function({author}) {
        return AuthorDB.find(doc => doc.author === author);
      }
    },
    createdAt: {type: GraphQLFloat},
    cursor: {type: GraphQLString},
    karma: {type: GraphQLInt},
    postId: {type: GraphQLString}
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
        let author;
        author = AuthorDB.find(doc => doc._id === source.ownerId);
        if (!author) {
          author =   GroupDB.find(doc => doc._id === source.ownerId);
        }
        return author;
      }
    },
    members: {
      type: new GraphQLList(MemberType),
      resolve(source) {
        return source.members.map(member => {
          let author;
          author = AuthorDB.find(doc => doc._id === member);
          if (!author) {
            author =   GroupDB.find(doc => doc._id === member);
          }
          return author;
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

const KeywordMentioned = new GraphQLObjectType({
  name: 'KeywordMentioned',
  fields: () => ({
    word: {type: GraphQLString, description: 'a word mentioned in the title'}
  })
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
        language: {type: GraphQLString, description: "Language of the title"},
        inReverse: {type: GraphQLBoolean, description: 'give the title in reverse'}
      },
      resolve(source, args) {
        if (args.language === 'spanish') {
          if (args.inReverse) {
            return source.title_ES.split('').reverse().join('');
          }
          return source.title_ES;
        }
        if (args.inReverse) {
          return source.title.split('').reverse().join('');
        }
        return source.title;
      }
    },
    category: {type: CategoryType},
    content: {type: GraphQLString},
    createdAt: {
      type: GraphQLInt,
      args: {
        dateOptions: {type: DateOptionsType, description: "example of a subfield with an input obj"}
      },
      resolve(source) {
        return source.createdAt
      }
    },
    comments: {
      type: new GraphQLList(CommentType),
      args: {
        beforeCursor: {type: GraphQLString, description: 'the cursor coming from the back'},
        afterCursor: {type: GraphQLString, description: 'the cursor coming from the front'},
        first: {type: GraphQLInt, description: "Limit the comments from the front"},
        last: {type: GraphQLInt, description: "Limit the comments from the back"}
      },
      resolve: function(post, args) {
        return handlePaginationArgs(args, CommentDB)
      }
    },
    author: {
      type: AuthorType,
      resolve: function({author}) {
        return AuthorDB.find(doc => doc._id === author);
      }
    },
    keywordsMentioned: {
      type: new GraphQLList(KeywordMentioned),
      description: 'a list of objects with a word prop for testing arrays of non-entity objects'
    },
    cursor: {type: GraphQLString}
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

const RemovePostMutationPayload = new GraphQLObjectType({
  name: "RemovePostMutationPayload",
  description: "Payload for removing a post",
  fields: () => ({
    removedPostId: {type: GraphQLString},
    postCount: {type: GraphQLInt}
  })
});

const NewPost = new GraphQLInputObjectType({
  name: "NewPost",
  description: "input object for a new post",
  fields: () => ({
    _id: {type: new GraphQLNonNull(GraphQLString)},
    content: {type: GraphQLString},
    title: {type: GraphQLString},
    category: {type: GraphQLString}
  })
});

const DateOptionsType = new GraphQLInputObjectType({
  name: "DateOptions",
  description: "formatting options for the date",
  fields: () => ({
    day: {type: GraphQLBoolean},
    month: {type: GraphQLBoolean},
    year: {type: GraphQLBoolean}
  })
});

const NewMember = new GraphQLInputObjectType({
  name: "NewMember",
  description: "input object for a new member",
  fields: () => ({
    _id: {type: new GraphQLNonNull(GraphQLString)},
    name: {type: GraphQLString},
    ownerId: {type: GraphQLString},
    members: {type: new GraphQLList(GraphQLString)},
    twitterHandle: {type: GraphQLString}
  })
});

const Query = new GraphQLObjectType({
  name: 'BlogSchema',
  description: "Root of the Blog Schema",
  fields: () => ({
    getPostCount: {
      type: new GraphQLNonNull(GraphQLInt),
      description: "the number of posts currently in the db",
      resolve() {
        return PostDB.length;
      }
    },
    getLatestPost: {
      type: PostType,
      description: "Latest post in the blog",
      resolve() {
        const sortedPosts = PostDB.sort((a, b) => b.createdAt - a.createdAt);
        return sortedPosts[0];
      }
    },
    getLatestPostId: {
      type: GraphQLString,
      description: "Latest post id in the blog",
      resolve() {
        const sortedPosts = PostDB.sort((a, b) => b.createdAt - a.createdAt);
        return sortedPosts[0]._id;
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
      resolve(source, args, ref) {
        const sortedPosts = PostDB.sort((a, b) => b.createdAt - a.createdAt);

        return handlePaginationArgs(args, sortedPosts);
      }
    },
    getPostById: {
      type: PostType,
      description: "PostType by _id",
      args: {
        _id: {type: new GraphQLNonNull(GraphQLString)}
      },
      resolve: function(source, {_id}) {
        return PostDB.find(doc => doc._id === _id);
      }
    },
    getGroup: {
      type: GroupType,
      args: {
        _id: {type: new GraphQLNonNull(GraphQLString)}
      },
      resolve(source, {_id}) {
        return GroupDB.find(doc => doc._id === _id);
      }
    },
    getCommentsByPostId: {
      type: new GraphQLList(CommentType),
      description: "Comments for a specific post",
      args: {
        postId: {type: new GraphQLNonNull(GraphQLString)}
      },
      resolve: function(source, {postId}) {
        return CommentDB.filter(doc => doc.postId === postId);
      }
    },
  })
});

const Mutation = new GraphQLObjectType({
  name: "BlogMutations",
  fields: () => ({
    createPost: {
      type: CreatePostMutationPayload,
      description: "Create a post",
      args: {
        newPost: {type: new GraphQLNonNull(NewPost)},
        // this is wrong to break out the author, but useful for testing different arg types
        author: {type: GraphQLString}
      },
      resolve(source, {newPost, author}) {
        const now = Date.now();
        const post = Object.assign({}, newPost, {
          karma: 0,
          createdAt: now,
          title_ES: `${newPost.title} EN ESPANOL!`,
          cursor: `${now}chikachikow`,
          author
        });
        PostDB.push(post);
        return {
          post,
          postCount: PostDB.length
        }
      }
    },
    removePostById: {
      type: RemovePostMutationPayload,
      description: 'Remove a post',
      args: {
        postId: {type: new GraphQLNonNull(GraphQLString)}
      },
      resolve(source, {postId}) {
        const removedPostIdx= PostDB.findIndex(doc => doc.postId === postId);
        let didRemove = false;
        if (removedPostIdx !== -1) {
          PostDB.splice(removedPostIdx,1);
          didRemove = true;
        }
        return {
          removedPostId: didRemove ? postId : null,
          postCount: Object.keys(PostDB).length
        };
      }
    },
    updatePost: {
      type: PostType,
      description: 'update a post',
      args: {
        post: {type: NewPost}
      },
      resolve(source, {post}) {
        const storedPost = PostDB.find(doc => doc._id === post._id);
        if (storedPost) {
          const updatedKeys = Object.keys(post);
          updatedKeys.forEach(key => {
            const value = post[key];
            if (value === null) {
              delete storedPost[key];
            } else {
              storedPost[key] = value
            }
          })
        }
        return storedPost;
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
        CommentDB.push(newPost);
        return newPost;
      }
    },
    createMembers: {
      type: new GraphQLList(MemberType),
      description: "Create multiple members",
      args: {
        members: {type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(NewMember)))}
      },
      resolve(source, {members}) {
        return members;
      }
    }
  })
});

export default new GraphQLSchema({
  query: Query,
  mutation: Mutation
});
