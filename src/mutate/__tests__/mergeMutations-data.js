import {parseAndAlias} from '../mergeMutations';

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

const createPostMutationWithCrazyFragsString = `
mutation {
  createPost(newPost: {_id: "129", author: "a123", content: "Hii", title:"Sao", category:"hot stuff"}) {
    post {
      _id
      content
      ...{
        spanishTitle: title(language: "spanish")
      }
      ...spreadLevel1
    }
  }
}
fragment spreadLevel1 on PostType {
    title
  	... {
      category
      ...spreadLevel2
    }
}
fragment spreadLevel2 on PostType {
  createdAt
}`;
export const createPostMutationWithCrazyFrags = parseAndAlias(createPostMutationWithCrazyFragsString, 'postCrazyFrags1');

const createPostMutationWithCrazyFrags2String = `
mutation {
  createPost(newPost: {_id: "129", author: "a123", content: "Hii", title:"Sao", category:"hot stuff"}) {
    post {
      ...{
        _id
      }
      ...spreadLevel1
    }
  }
}
fragment spreadLevel1 on PostType {
  	... {
      category
      ...spreadLevel2
    }
}
fragment spreadLevel2 on PostType {
  title(language:"spanish")
}`;
export const createPostMutationWithCrazyFrags2 = parseAndAlias(createPostMutationWithCrazyFrags2String, 'postCrazyFrags2');
