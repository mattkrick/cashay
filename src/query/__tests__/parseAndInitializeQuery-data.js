export const fragmentQueryString = `
query {
  getRecentPosts {
    _id,
    author {
      ...getAuthor
      _id
    },
  }
}

fragment getAuthor on AuthorType {
  	name
}`;

export const inlineQueryString = `
query {
  getRecentPosts {
    _id,
    author {
      ... on AuthorType {
  	    name
      }
      _id
    },
  }
}`;

export const inlineQueryStringWithoutId = `
query {
  getRecentPosts {
    author {
      ... on AuthorType {
  	    name
      }
      _id
    },
  }
}`;

export const unionQueryString = `
query {
  getGroup(_id: "g123") {
    _id
    owner {
      __typename
      _id
      ... on AuthorType {
        name
        twitterHandle
      }
    }
  }
}`;

export const unionQueryStringWithoutTypename = `
query {
  getGroup(_id: "g123") {
    _id
    owner {
      _id
      ... on AuthorType {
        name
        twitterHandle
      }
    }
  }
}`;

export const unionQueryStringWithExtraTypenameId = `
query {
  getGroup(_id: "g123") {
    _id
    owner {
      __typename
      _id
      ... on AuthorType {
        __typename
        _id
        name
        twitterHandle
      }
    }
  }
}`;

export const queryWithSortedArgs = `
query {
  getLatestPost {
    _id
		title(inReverse: true, language: "english")
  }
}`;

export const queryWithUnsortedArgs = `
query {
  getLatestPost {
    _id
		title(language: "english", inReverse: true)
  }
}`;
