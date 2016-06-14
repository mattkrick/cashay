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
        "owner": "AuthorType::a123",
        "members": [
          "AuthorType::a123",
          "AuthorType::a124"
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
      "{\"_id\":\"g123\"}": "Group::g123"
    }
  }
};

export const unionStoreMissingOwnerMembers = {
  "entities": {
    "Group": {
      "g123": {
        "_id": "g123"
      }
    },
    "AuthorType": {
      "a124": {
        "_id": "a124",
        "name": "Joe J"
      }
    }
  },
  "result": {
    "getGroup": {
      "{\"_id\":\"g123\"}": "Group::g123"
    }
  }
};

export const unionMissingOwnerMembersDenormalized = {
  "getGroup": {
    "_id": "g123",
    "owner": {
      "__typename": null,
      "_id": null,
      "name": null,
      "twitterHandle": null
    },
    "members": []
  }
};
