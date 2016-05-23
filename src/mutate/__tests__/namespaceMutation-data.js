export const createCommentWithId = `
  mutation {
    createComment(postId: $postId, content: "foo") {
      _id,
    }
  }`;

export const createCommentDifferentArg = `
  mutation {
    createComment(postId: $postIdz) {
      _id,
    }
  }`;

export const badArg = `
  mutation {
    createComment(postIdz: $postIdz) {
      _id,
    }
  }`;

export const createMembers = `mutation {
    createMembers(members: $newMembers) {
      __typename
    }
  }`;

export const mixHardSoftArgs = `
  mutation {
    createPost(newPost: {_id: $postIdz}) {
      _id,
    }
  }`;

export const nestedFragmentSpreads = `
mutation {
  createPost(newPost: {_id: "129"}) {
    post {
      ... {
        ...spreadLevel1
      }
    }
  }
}
fragment spreadLevel1 on PostType {
  	... {
      ...spreadLevel2
    }
}
fragment spreadLevel2 on PostType {
  createdAt
}`;

export const postSpanishTitle = `
  mutation {
    createPost(newPost: {_id: "129"}) {
      post {
        title(language:"spanish")
        englishTitle: title(language:"english")
      }
    }
  }`;

export const postSpanishTitleVars = `
  mutation {
    createPost(newPost: {_id: $newPostId}) {
      post {
        title(language: $defaultLanguage),
        englishTitle: title(language: $secondaryLanguage)
      }
    }
  }`;

export const mixPostFieldArgs = `
  mutation {
    createPost(newPost: {_id: "123"}) {
      post {
        createdAt(dateOptions: {day: $day, month: true, year: $year})
      }
    }
  }`;
