import {parseAndAlias} from '../src/mutate/mergeMutations';

const creatCommentMutationWithIdString = `
  mutation($postId: String!, $content: String!) {
    createComment(postId: $postId, content: $content) {
      _id,
    }
  }`;
export const creatCommentMutationWithId = parseAndAlias(creatCommentMutationWithIdString, 'commentWithId');

const creatCommentMutationWithContentString = `
  mutation($postId: String!, $content: String!) {
    createComment(postId: $postId, content: $content) {
      content
    }
  }`;
export const creatCommentMutationWithContent = parseAndAlias(creatCommentMutationWithContentString, 'commentWithContent');

const createPostMutationWithPostTitleAndCountString = `
  mutation {
    createPost(newPost: {_id: "129", author: "a123", content: "X", title:"Y", category:"hot stuff"}) {
      post {
        title
      }
      postCount
    }
  }`;
export const createPostMutationWithPostTitleAndCount = parseAndAlias(createPostMutationWithPostTitleAndCountString, 'postTitleCount')

const createPostMutationWithPostIdString = `
  mutation {
    createPost(newPost: {_id: "129", author: "a123", content: "X", title:"Y", category:"hot stuff"}) {
      post {
        _id
      }
    }
  }`;
export const createPostMutationWithPostId = parseAndAlias(createPostMutationWithPostIdString, 'postWithId')

const createPostMutationWithIncompleteArgsString = `
  mutation {
    createPost(newPost: {_id: "129"}) {
      post {
        _id
      }
    }
  }`;
export const createPostMutationWithIncompleteArgs = parseAndAlias(createPostMutationWithIncompleteArgsString, 'postIncompleteArgs')

const createPostMutationWithDifferentIdString = `
  mutation {
    createPost(newPost: {_id: "130"}) {
      post {
        _id
      }
    }
  }`;
export const createPostMutationWithDifferentId = parseAndAlias(createPostMutationWithDifferentIdString, 'postDifferentId')

const createPostMutationWithSpanishTitleString = `
  mutation {
    createPost(newPost: {_id: "129", author: "a123", content: "X", title:"Y", category:"hot stuff"}) {
      post {
        title(language:"spanish")
      }
    }
  }`;
export const createPostMutationWithSpanishTitle = parseAndAlias(createPostMutationWithSpanishTitleString, 'postSpanishTitle')
