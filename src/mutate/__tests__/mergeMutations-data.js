import {parseAndAlias} from '../mergeMutations';

export const creatCommentWithId = `
  mutation($postId: String!, $content: String!) {
    createComment(postId: $postId, content: $content) {
      _id,
    }
  }`;

export const creatCommentWithContent = `
  mutation($postId: String!, $content: String!) {
    createComment(postId: $postId, content: $content) {
      content
    }
  }`;

export const createPostWithPostTitleAndCount = `
  mutation {
    createPost(newPost: {_id: "129", author: "a123", content: "X", title:"Y", category:"hot stuff"}) {
      post {
        title
      }
      postCount
    }
  }`;

export const createPostWithPostId = `
  mutation {
    createPost(newPost: {_id: "129", author: "a123", content: "X", title:"Y", category:"hot stuff"}) {
      post {
        _id
      }
    }
  }`;

export const createPostWithIncompleteArgs = `
  mutation {
    createPost(newPost: {_id: "129"}) {
      post {
        _id
      }
    }
  }`;

export const createPostWithDifferentId = `
  mutation {
    createPost(newPost: {_id: "130"}) {
      post {
        _id
      }
    }
  }`;

export const createPostWithSpanishTitle = `
  mutation {
    createPost(newPost: {_id: "129", author: "a123", content: "X", title:"Y", category:"hot stuff"}) {
      post {
        title(language:"spanish")
      }
    }
  }`;

export const createPostWithCrazyFrags = `
mutation {
  createPost(newPost: {_id: "129", author: "a123", content: "Hii", title:"Sao", category:"hot stuff"}, author: $author) {
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

export const createPostWithCrazyFrags2 = `
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
