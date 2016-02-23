export const back5Response = {
  "data": {
    "recentPosts": [
      {
        "_id": "0176413761b289e6d64c2c14a758c1c7",
        "cursor": "2015-07-07T00:00:00.000Z",
        "title": "Sharing the Meteor Login State Between Subdomains"
      },
      {
        "_id": "1bd16dfab1de982317d2ba4382ec8c86",
        "cursor": "2015-07-01T00:00:00.000Z",
        "title": "Meteor Server Side Rendering Support with FlowRouter and React"
      },
      {
        "_id": "19085291c89f0d04943093c4ff16b664",
        "cursor": "2014-09-08T00:00:00.000Z",
        "title": "Awesome Error Tracking Solution for Meteor Apps with Kadira"
      },
      {
        "_id": "0be4bea0330ccb5ecf781a9f69a64bc8",
        "cursor": "2014-06-30T00:00:00.000Z",
        "title": "What Should Kadira Build Next?"
      },
      {
        "_id": "1afff9dfb0b97b5882c72cb60844e034",
        "cursor": "2014-06-12T00:00:00.000Z",
        "title": "Tracking Meteor CPU Usage with Kadira"
      }
    ]
  }
}

export const back5Query = `
query {
  recentPosts(count:5 before: "2014-05-27T00:00:00.000Z") {
    _id,
    cursor,
    title
  }
}`

export const front5Response = {
  "data": {
    "recentPosts": [
      {
        "_id": "03390abb5570ce03ae524397d215713b",
        "cursor": "2015-09-01T00:00:00.000Z",
        "title": "New Feature: Tracking Error Status with Kadira"
      },
      {
        "_id": "2f6b59fd0b182dc6e2f0051696c70d70",
        "cursor": "2015-08-24T00:00:00.000Z",
        "title": "Understanding Mean, Histogram and Percentiles"
      },
      {
        "_id": "3d7a3853bf435c0f00e46e15257a94d9",
        "cursor": "2015-07-20T00:00:00.000Z",
        "title": "Introducing Kadira Debug, Version 2"
      },
      {
        "_id": "0176413761b289e6d64c2c14a758c1c7",
        "cursor": "2015-07-07T00:00:00.000Z",
        "title": "Sharing the Meteor Login State Between Subdomains"
      },
      {
        "_id": "1bd16dfab1de982317d2ba4382ec8c86",
        "cursor": "2015-07-01T00:00:00.000Z",
        "title": "Meteor Server Side Rendering Support with FlowRouter and React"
      }
    ]
  }
};

export const front5Query = `query {
  recentPosts(count:5) {
    _id,
      cursor,
      title
  }
}`;

export const front5Normalized = {
  "entities": {
    "Post": {
      "03390abb5570ce03ae524397d215713b": {
        "_id": "03390abb5570ce03ae524397d215713b",
        "cursor": "2015-09-01T00:00:00.000Z",
        "title": {
          "": "New Feature: Tracking Error Status with Kadira"
        }
      },
      "2f6b59fd0b182dc6e2f0051696c70d70": {
        "_id": "2f6b59fd0b182dc6e2f0051696c70d70",
        "cursor": "2015-08-24T00:00:00.000Z",
        "title": {
          "": "Understanding Mean, Histogram and Percentiles"
        }
      },
      "3d7a3853bf435c0f00e46e15257a94d9": {
        "_id": "3d7a3853bf435c0f00e46e15257a94d9",
        "cursor": "2015-07-20T00:00:00.000Z",
        "title": {
          "": "Introducing Kadira Debug, Version 2"
        }
      },
      "0176413761b289e6d64c2c14a758c1c7": {
        "_id": "0176413761b289e6d64c2c14a758c1c7",
        "cursor": "2015-07-07T00:00:00.000Z",
        "title": {
          "": "Sharing the Meteor Login State Between Subdomains"
        }
      },
      "1bd16dfab1de982317d2ba4382ec8c86": {
        "_id": "1bd16dfab1de982317d2ba4382ec8c86",
        "cursor": "2015-07-01T00:00:00.000Z",
        "title": {
          "": "Meteor Server Side Rendering Support with FlowRouter and React"
        }
      }
    }
  },
  "result": {
    "recentPosts": {
      "front": [
        "Post:03390abb5570ce03ae524397d215713b",
        "Post:2f6b59fd0b182dc6e2f0051696c70d70",
        "Post:3d7a3853bf435c0f00e46e15257a94d9",
        "Post:0176413761b289e6d64c2c14a758c1c7",
        "Post:1bd16dfab1de982317d2ba4382ec8c86"
      ]
    }
  }
}

export const back5Normalized = {
  "entities": {
    "Post": {
      "0176413761b289e6d64c2c14a758c1c7": {
        "_id": "0176413761b289e6d64c2c14a758c1c7",
        "cursor": "2015-07-07T00:00:00.000Z",
        "title": {
          "": "Sharing the Meteor Login State Between Subdomains"
        }
      },
      "1bd16dfab1de982317d2ba4382ec8c86": {
        "_id": "1bd16dfab1de982317d2ba4382ec8c86",
        "cursor": "2015-07-01T00:00:00.000Z",
        "title": {
          "": "Meteor Server Side Rendering Support with FlowRouter and React"
        }
      },
      "19085291c89f0d04943093c4ff16b664": {
        "_id": "19085291c89f0d04943093c4ff16b664",
        "cursor": "2014-09-08T00:00:00.000Z",
        "title": {
          "": "Awesome Error Tracking Solution for Meteor Apps with Kadira"
        }
      },
      "0be4bea0330ccb5ecf781a9f69a64bc8": {
        "_id": "0be4bea0330ccb5ecf781a9f69a64bc8",
        "cursor": "2014-06-30T00:00:00.000Z",
        "title": {
          "": "What Should Kadira Build Next?"
        }
      },
      "1afff9dfb0b97b5882c72cb60844e034": {
        "_id": "1afff9dfb0b97b5882c72cb60844e034",
        "cursor": "2014-06-12T00:00:00.000Z",
        "title": {
          "": "Tracking Meteor CPU Usage with Kadira"
        }
      }
    }
  },
  "result": {
    "recentPosts": {
      "back": [
        "Post:0176413761b289e6d64c2c14a758c1c7",
        "Post:1bd16dfab1de982317d2ba4382ec8c86",
        "Post:19085291c89f0d04943093c4ff16b664",
        "Post:0be4bea0330ccb5ecf781a9f69a64bc8",
        "Post:1afff9dfb0b97b5882c72cb60844e034"
      ]
    }
  }
}
