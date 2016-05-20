
export const queryCommentsForPostId = `
query($postId: String!) {
  comments: getCommentsByPostId(postId: $postId) {
    _id
  }
}`;

export const mutationForCommentQueryNoVars = `
mutation {
  createComment {
    _id
  }
}`;

export const mutationForCommentQuery = `
mutation {
  createComment (_id: $_id, postId: $postId, content: $content) {
    _id
  }
}`;

export const queryMultipleComments = `
query($postId: String!, $postId2: String!) {
  comments: getCommentsByPostId(postId: $postId) {
    _id
  }
  comments2: getCommentsByPostId(postId: $postId2) {
    createdAt
  }
}`;

export const mutationForMultipleComments = `
mutation {
  createComment (_id: $_id, postId: $postId, content: $content) {
    _id
    createdAt
  }
}`;

export const queryPost = `
  query($first: Int!) {
    getRecentPosts(count: $first) {
      _id,
    }
  }`;

export const mutatePost = `
mutation {
  createPost {
    post {
      _id
    }
  }
}`;

export const queryPostWithFieldVars = `
  query($first: Int!, $defaultLanguage: String, $secondaryLanguage: String) {
    getRecentPosts(count: $first) {
      title(language: $defaultLanguage),
      secondaryTitle: title(language: $secondaryLanguage)
    }
  }`;

export const mutatePostWithFieldVars = `
mutation {
  createPost {
    post {
      title(language: $defaultLanguage),
      secondaryTitle: title(language: $secondaryLanguage)
    }
  }
}`;

export const queryPostCount = `
  query {
    getPostCount
  }`;

export const mutatePostCount = `
mutation {
  createPost {
    postCount
  }
}`;

export const queryPostCountAliased = `
  query {
    postCount: getPostCount
  }`;

export const queryPostWithInlineFieldVars = `
  query($first: Int!, $defaultLanguage: String, $secondaryLanguage: String) {
    getRecentPosts(count: $first) {
      ... on PostType {
        title(language: $defaultLanguage),
        secondaryTitle: title(language: $secondaryLanguage)
      }
    }
  }`;

export const mutatePostWithInlineFieldVars = `
mutation {
  createPost {
    post {
      ... on PostType {
        title(language: $defaultLanguage),
        secondaryTitle: title(language: $secondaryLanguage)
      }
    }
  }
}`;

export const queryMultiplePosts = `
query {
  getLatestPost {
    _id
  }
  getRecentPosts {
    createdAt
  }
}`;

export const mutationForMultiplePosts = `
mutation {
  createPost {
    post {
      _id
      createdAt
    }
  }
}`;
