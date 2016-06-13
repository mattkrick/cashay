import {parse} from '../../utils';
import namespaceMutation from '../namespaceMutation';
import clientSchema from '../../__tests__/clientSchema.json';

export const parseAndNamespace = cachedSingles => {
  return cachedSingles.map((single, idx) => {
    const ast = parse(single);
    const componentId = `component${idx}`;
    const {namespaceAST} = namespaceMutation(ast, componentId, {}, clientSchema);
    return namespaceAST;
  });
};

export const createCommentWithId = `
  mutation($postId: String!, $content: String!) {
    createComment(postId: $postId, content: $content) {
      _id,
    }
  }`;

export const createCommentWithId2 = `
  mutation($postId: String!, $content: String!, $_id: String!) {
    createComment(postId: $postId, content: $content, _id: $_id) {
      _id,
    }
  }`;

export const createCommentWithContent = `
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

export const createPostWithBadArgKind = `
  mutation {
    createPost(newPost: "foo") {
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

export const typedInlineFrag1 = `
mutation {
  createPost(newPost: {_id: "129"}) {
    post {
      ... on PostType {
        title
      }
    }
  }
}`;

export const typedInlineFrag2 = `
mutation {
  createPost(newPost: {_id: "129"}) {
    post {
      ... on PostType {
        category
      }
    }
  }
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
