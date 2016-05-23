export const unionQueryString = `
query {
  getGroup(_id: "g123") {
    _id
    owner {
      __typename
      ... on AuthorType {
        _id
        name
        twitterHandle
      }
    }
    members {
      __typename
      ... on AuthorType {
        _id
        name
      }
      ... on Group {
        _id
        members {
          __typename
          ... on AuthorType {
            _id
            name
          }
        }
      }
    }
  }
}`;

export const unionResponse = {
  "data": {
    "getGroup": {
      "_id": "g123",
      "owner": {
        "__typename": "AuthorType",
        "_id": "a123",
        "name": "Matt K",
        "twitterHandle": "@__mattk"
      },
      "members": [
        {
          "__typename": "AuthorType",
          "_id": "a123",
          "name": "Matt K"
        },
        {
          "__typename": "AuthorType",
          "_id": "a124",
          "name": "Joe J"
        }
      ]
    }
  }
};


export const unionStoreFull = {
  "entities": {
    "Group": {
      "g123": {
        "_id": "g123",
        "owner": "AuthorType:a123",
        "members": [
          "AuthorType:a123",
          "AuthorType:a124"
        ]
      }
    },
    "AuthorType": {
      "a123": {
        "_id": "a123",
        "name": "Matt K",
        "twitterHandle": "@__mattk"
      },
      "a124": {
        "_id": "a124",
        "name": "Joe J"
      }
    }
  },
  "result": {
    "getGroup": {
      "{\"_id\":\"g123\"}": "Group:g123"
    }
  }
};

export const initialState = {
  entities: {},
  result: {}
};

export const initialStateResponse = {
  "data": {
    "getGroup": {
      "_id": null,
      "owner": {
        "__typename": null,
        "_id": null,
        "name": null,
        "twitterHandle": null
      },
      "members": []
    }
  }
};

export const unionQueryStringExtraTwitter = `
query {
  getGroup(_id: "allEmployees") {
    _id
    owner {
      __typename
      ... on Author {
        _id
        name
        twitterHandle
      }
    }
    members {
      __typename
      ... on Author {
        _id
        name
        twitterHandle
      }
      ... on Group {
        _id
        members {
          __typename
          ... on Author {
            _id
            name
            twitterHandle
          }
        }
      }
    }
  }
}`

export const unionResponsePartialTwitter = {
  "data": {
    "getGroup": {
      "_id": "allEmployees",
      "owner": {
        "__typename": "Author",
        "_id": "arunoda",
        "name": "Arunoda Susiripala",
        "twitterHandle": "@arunoda"
      },
      "members": [
        {
          "__typename": "Author",
          "_id": "indi",
          "name": "Kasun Indi",
          "twitterHandle": null
        },
        {
          "__typename": "Group",
          "_id": "executiveTeam",
          "members": [
            {
              "__typename": "Author",
              "_id": "arunoda",
              "name": "Arunoda Susiripala",
              "twitterHandle": "@arunoda"
            },
            {
              "__typename": "Author",
              "_id": "pahan",
              "name": "Pahan Sarathchandra",
              "twitterHandle": null
            }
          ]
        }
      ]
    }
  }
};


export const unionQueryStringExtraOwner = `
query {
  getGroup(_id: "allEmployees") {
    _id
    owner {
      ... on Author {
        _id
        name
        twitterHandle
      }
      ... on Group {
        _id
        members {
          __typename
        }
      }
    }
  }
}`

export const unionNormalizedMissingOwner = {
  entities: {
    Group: {
      allEmployees: {
        _id: 'allEmployees'
      }
    }
  },
  result: {
    getGroup: {
      '{"_id":"allEmployees"}': 'Group:allEmployees'
    }
  }
};

export const unionResponseMissingOwner = {
  "data": {
    "getGroup": {
      "_id": "allEmployees",
      "owner": {
        "__typename": null,
        "_id": null,
        "name": null,
        "twitterHandle": null,
        "members": []
      }
    }
  }
}
