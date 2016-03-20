export const unionQueryString = `
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
      }
      ... on Group {
        _id
        members {
          __typename
          ... on Author {
            _id
            name
          }
        }
      }
    }
  }
}`

export const unionResponse = {
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
          "name": "Kasun Indi"
        },
        {
          "__typename": "Group",
          "_id": "executiveTeam",
          "members": [
            {
              "__typename": "Author",
              "_id": "arunoda",
              "name": "Arunoda Susiripala"
            },
            {
              "__typename": "Author",
              "_id": "pahan",
              "name": "Pahan Sarathchandra"
            }
          ]
        }
      ]
    }
  }
}


export const unionNormalized ={
  entities: {
    Group: {
      allEmployees: {
        _id: 'allEmployees',
        owner: 'Author:arunoda',
        members: ['Author:indi', 'Group:executiveTeam']
      },
      executiveTeam: {
        "_id": "executiveTeam",
        "members": ['Author:arunoda', 'Author:pahan']
      }
    },
    Author: {
      arunoda: {
        "_id": "arunoda",
        "name": "Arunoda Susiripala",
        "twitterHandle": "@arunoda"
      },
      indi: {
        "_id": "indi",
        "name": "Kasun Indi"
      },
      pahan: {
        "_id": "pahan",
        "name": "Pahan Sarathchandra"
      }
    }
  },
  result: {
    getGroup: {
      '{"_id":"allEmployees"}': 'Group:allEmployees'
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
        }
      }
    }
  }
}`

export const unionNormalizedMissingOwner ={
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
