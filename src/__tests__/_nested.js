export const nestedPaginationWords = {
  first: 'count'
};

export const nestedVariableValues = {
  language: 'english'
};

export const nestedQueryString = `
query getPosts($language: String) {
  recentPosts(count: 2) {
    _id,
    title,
    author {
      ...getAuthor
    },
    comments {
      _id,
      replies {
        _id,
        content
      }
    }
  },
  again: recentPosts(count: 2) {
    _id,
      title (language: $language),
    author {
    ...getAuthor
    },
    comments {
      _id,
        content,
        replies {
        _id,
          content
      }
    }
  }
}

fragment getAuthor on Author {
  ... on Author {
		_id
  	name
  	twitterHandle
  }
}`;

export const nestedResponse = {
  "recentPosts": [
    {
      "_id": "03390abb5570ce03ae524397d215713b",
      "title": "New Feature: Tracking Error Status with Kadira",
      "author": {
        "_id": "pahan",
        "name": "Pahan Sarathchandra",
        "twitterHandle": "@pahans"
      },
      "comments": [
        {
          "_id": "cid-19710666",
          "replies": [
            {
              "_id": "cid-37250492",
              "content": "Thank You!"
            },
            {
              "_id": "cid-2617133",
              "content": "If you need more information, just contact me."
            }
          ]
        },
        {
          "_id": "cid-8221034",
          "replies": [
            {
              "_id": "cid-37250492",
              "content": "Thank You!"
            },
            {
              "_id": "cid-2617133",
              "content": "If you need more information, just contact me."
            }
          ]
        }
      ]
    },
    {
      "_id": "2f6b59fd0b182dc6e2f0051696c70d70",
      "title": "Understanding Mean, Histogram and Percentiles",
      "author": {
        "_id": "arunoda",
        "name": "Arunoda Susiripala",
        "twitterHandle": "@arunoda"
      },
      "comments": [
        {
          "_id": "cid-19710666",
          "replies": [
            {
              "_id": "cid-37250492",
              "content": "Thank You!"
            },
            {
              "_id": "cid-2617133",
              "content": "If you need more information, just contact me."
            }
          ]
        },
        {
          "_id": "cid-8221034",
          "replies": [
            {
              "_id": "cid-37250492",
              "content": "Thank You!"
            },
            {
              "_id": "cid-2617133",
              "content": "If you need more information, just contact me."
            }
          ]
        }
      ]
    }
  ],
  "again": [
    {
      "_id": "03390abb5570ce03ae524397d215713b",
      "title": "New Feature: Tracking Error Status with Kadira",
      "author": {
        "_id": "pahan",
        "name": "Pahan Sarathchandra",
        "twitterHandle": "@pahans"
      },
      "comments": [
        {
          "_id": "cid-19710666",
          "content": "This is a very good blog post",
          "replies": [
            {
              "_id": "cid-37250492",
              "content": "Thank You!"
            },
            {
              "_id": "cid-2617133",
              "content": "If you need more information, just contact me."
            }
          ]
        },
        {
          "_id": "cid-8221034",
          "content": "Keep up the good work",
          "replies": [
            {
              "_id": "cid-37250492",
              "content": "Thank You!"
            },
            {
              "_id": "cid-2617133",
              "content": "If you need more information, just contact me."
            }
          ]
        }
      ]
    },
    {
      "_id": "2f6b59fd0b182dc6e2f0051696c70d70",
      "title": "Understanding Mean, Histogram and Percentiles",
      "author": {
        "_id": "arunoda",
        "name": "Arunoda Susiripala",
        "twitterHandle": "@arunoda"
      },
      "comments": [
        {
          "_id": "cid-19710666",
          "content": "This is a very good blog post",
          "replies": [
            {
              "_id": "cid-37250492",
              "content": "Thank You!"
            },
            {
              "_id": "cid-2617133",
              "content": "If you need more information, just contact me."
            }
          ]
        },
        {
          "_id": "cid-8221034",
          "content": "Keep up the good work",
          "replies": [
            {
              "_id": "cid-37250492",
              "content": "Thank You!"
            },
            {
              "_id": "cid-2617133",
              "content": "If you need more information, just contact me."
            }
          ]
        }
      ]
    }
  ]
};


export const nestedNormalized = {
  "entities": {
    "Post": {
      "03390abb5570ce03ae524397d215713b": {
        "_id": "03390abb5570ce03ae524397d215713b",
        "title": {
          "": "New Feature: Tracking Error Status with Kadira",
          "{\"language\":\"english\"}": "New Feature: Tracking Error Status with Kadira"
        },
        "author": "Author:pahan",
        "comments": {
          "": [
            "Comment:cid-19710666",
            "Comment:cid-8221034"
          ]
        }
      },
      "2f6b59fd0b182dc6e2f0051696c70d70": {
        "_id": "2f6b59fd0b182dc6e2f0051696c70d70",
        "title": {
          "": "Understanding Mean, Histogram and Percentiles",
          "{\"language\":\"english\"}": "Understanding Mean, Histogram and Percentiles"
        },
        "author": "Author:arunoda",
        "comments": {
          "": [
            "Comment:cid-19710666",
            "Comment:cid-8221034"
          ]
        }
      }
    },
    "Author": {
      "pahan": {
        "_id": "pahan",
        "name": "Pahan Sarathchandra",
        "twitterHandle": "@pahans"
      },
      "arunoda": {
        "_id": "arunoda",
        "name": "Arunoda Susiripala",
        "twitterHandle": "@arunoda"
      }
    },
    "Comment": {
      "cid-19710666": {
        "_id": "cid-19710666",
        "replies": [
          "Comment:cid-37250492",
          "Comment:cid-2617133"
        ],
        "content": "This is a very good blog post"
      },
      "cid-37250492": {
        "_id": "cid-37250492",
        "content": "Thank You!"
      },
      "cid-2617133": {
        "_id": "cid-2617133",
        "content": "If you need more information, just contact me."
      },
      "cid-8221034": {
        "_id": "cid-8221034",
        "replies": [
          "Comment:cid-37250492",
          "Comment:cid-2617133"
        ],
        "content": "Keep up the good work"
      }
    }
  },
  "result": {
    "recentPosts": {
      "front": [
        "Post:03390abb5570ce03ae524397d215713b",
        "Post:2f6b59fd0b182dc6e2f0051696c70d70"
      ]
    }
  }
};

export const nestedNormalizedNoFirstAuthor = {
  "entities": {
    "Post": {
      "03390abb5570ce03ae524397d215713b": {
        "_id": "03390abb5570ce03ae524397d215713b",
        "title": {
          "": "New Feature: Tracking Error Status with Kadira",
          "{\"language\":\"english\"}": "New Feature: Tracking Error Status with Kadira"
        },
        "comments": {
          "": [
            "Comment:cid-19710666",
            "Comment:cid-8221034"
          ]
        }
      },
      "2f6b59fd0b182dc6e2f0051696c70d70": {
        "_id": "2f6b59fd0b182dc6e2f0051696c70d70",
        "title": {
          "": "Understanding Mean, Histogram and Percentiles",
          "{\"language\":\"english\"}": "Understanding Mean, Histogram and Percentiles"
        },
        "author": "Author:arunoda",
        "comments": {
          "": [
            "Comment:cid-19710666",
            "Comment:cid-8221034"
          ]
        }
      }
    },
    "Author": {
      "pahan": {
        "_id": "pahan",
        "name": "Pahan Sarathchandra",
        "twitterHandle": "@pahans"
      },
      "arunoda": {
        "_id": "arunoda",
        "name": "Arunoda Susiripala",
        "twitterHandle": "@arunoda"
      }
    },
    "Comment": {
      "cid-19710666": {
        "_id": "cid-19710666",
        "replies": [
          "Comment:cid-37250492",
          "Comment:cid-2617133"
        ],
        "content": "This is a very good blog post"
      },
      "cid-37250492": {
        "_id": "cid-37250492",
        "content": "Thank You!"
      },
      "cid-2617133": {
        "_id": "cid-2617133",
        "content": "If you need more information, just contact me."
      },
      "cid-8221034": {
        "_id": "cid-8221034",
        "replies": [
          "Comment:cid-37250492",
          "Comment:cid-2617133"
        ],
        "content": "Keep up the good work"
      }
    }
  },
  "result": {
    "recentPosts": {
      "front": [
        "Post:03390abb5570ce03ae524397d215713b",
        "Post:2f6b59fd0b182dc6e2f0051696c70d70"
      ]
    }
  }
};

export const nestedNormalizedNoFirstComments = {
  "entities": {
    "Post": {
      "03390abb5570ce03ae524397d215713b": {
        "_id": "03390abb5570ce03ae524397d215713b",
        "title": {
          "": "New Feature: Tracking Error Status with Kadira",
          "{\"language\":\"english\"}": "New Feature: Tracking Error Status with Kadira"
        },
        "author": "Author:pahan"
      },
      "2f6b59fd0b182dc6e2f0051696c70d70": {
        "_id": "2f6b59fd0b182dc6e2f0051696c70d70",
        "title": {
          "": "Understanding Mean, Histogram and Percentiles",
          "{\"language\":\"english\"}": "Understanding Mean, Histogram and Percentiles"
        },
        "author": "Author:arunoda",
        "comments": {
          "": [
            "Comment:cid-19710666",
            "Comment:cid-8221034"
          ]
        }
      }
    },
    "Author": {
      "pahan": {
        "_id": "pahan",
        "name": "Pahan Sarathchandra",
        "twitterHandle": "@pahans"
      },
      "arunoda": {
        "_id": "arunoda",
        "name": "Arunoda Susiripala",
        "twitterHandle": "@arunoda"
      }
    },
    "Comment": {
      "cid-19710666": {
        "_id": "cid-19710666",
        "replies": [
          "Comment:cid-37250492",
          "Comment:cid-2617133"
        ],
        "content": "This is a very good blog post"
      },
      "cid-37250492": {
        "_id": "cid-37250492",
        "content": "Thank You!"
      },
      "cid-2617133": {
        "_id": "cid-2617133",
        "content": "If you need more information, just contact me."
      },
      "cid-8221034": {
        "_id": "cid-8221034",
        "replies": [
          "Comment:cid-37250492",
          "Comment:cid-2617133"
        ],
        "content": "Keep up the good work"
      }
    }
  },
  "result": {
    "recentPosts": {
      "front": [
        "Post:03390abb5570ce03ae524397d215713b",
        "Post:2f6b59fd0b182dc6e2f0051696c70d70"
      ]
    }
  }
};

export const nestedResponseNoFirstAuthor = {
  "recentPosts": [
    {
      "_id": "03390abb5570ce03ae524397d215713b",
      "title": "New Feature: Tracking Error Status with Kadira",
      "author": {
        "_id": null,
        "name": null,
        "twitterHandle": null
      },
      "comments": [
        {
          "_id": "cid-19710666",
          "replies": [
            {
              "_id": "cid-37250492",
              "content": "Thank You!"
            },
            {
              "_id": "cid-2617133",
              "content": "If you need more information, just contact me."
            }
          ]
        },
        {
          "_id": "cid-8221034",
          "replies": [
            {
              "_id": "cid-37250492",
              "content": "Thank You!"
            },
            {
              "_id": "cid-2617133",
              "content": "If you need more information, just contact me."
            }
          ]
        }
      ]
    },
    {
      "_id": "2f6b59fd0b182dc6e2f0051696c70d70",
      "title": "Understanding Mean, Histogram and Percentiles",
      "author": {
        "_id": "arunoda",
        "name": "Arunoda Susiripala",
        "twitterHandle": "@arunoda"
      },
      "comments": [
        {
          "_id": "cid-19710666",
          "replies": [
            {
              "_id": "cid-37250492",
              "content": "Thank You!"
            },
            {
              "_id": "cid-2617133",
              "content": "If you need more information, just contact me."
            }
          ]
        },
        {
          "_id": "cid-8221034",
          "replies": [
            {
              "_id": "cid-37250492",
              "content": "Thank You!"
            },
            {
              "_id": "cid-2617133",
              "content": "If you need more information, just contact me."
            }
          ]
        }
      ]
    }
  ],
  "again": [
    {
      "_id": "03390abb5570ce03ae524397d215713b",
      "title": "New Feature: Tracking Error Status with Kadira",
      "author": {
        "_id": null,
        "name": null,
        "twitterHandle": null
      },
      "comments": [
        {
          "_id": "cid-19710666",
          "content": "This is a very good blog post",
          "replies": [
            {
              "_id": "cid-37250492",
              "content": "Thank You!"
            },
            {
              "_id": "cid-2617133",
              "content": "If you need more information, just contact me."
            }
          ]
        },
        {
          "_id": "cid-8221034",
          "content": "Keep up the good work",
          "replies": [
            {
              "_id": "cid-37250492",
              "content": "Thank You!"
            },
            {
              "_id": "cid-2617133",
              "content": "If you need more information, just contact me."
            }
          ]
        }
      ]
    },
    {
      "_id": "2f6b59fd0b182dc6e2f0051696c70d70",
      "title": "Understanding Mean, Histogram and Percentiles",
      "author": {
        "_id": "arunoda",
        "name": "Arunoda Susiripala",
        "twitterHandle": "@arunoda"
      },
      "comments": [
        {
          "_id": "cid-19710666",
          "content": "This is a very good blog post",
          "replies": [
            {
              "_id": "cid-37250492",
              "content": "Thank You!"
            },
            {
              "_id": "cid-2617133",
              "content": "If you need more information, just contact me."
            }
          ]
        },
        {
          "_id": "cid-8221034",
          "content": "Keep up the good work",
          "replies": [
            {
              "_id": "cid-37250492",
              "content": "Thank You!"
            },
            {
              "_id": "cid-2617133",
              "content": "If you need more information, just contact me."
            }
          ]
        }
      ]
    }
  ]
};

export const nestedResponseNoFirstComments = {
  "recentPosts": [
    {
      "_id": "03390abb5570ce03ae524397d215713b",
      "title": "New Feature: Tracking Error Status with Kadira",
      "author": {
        "_id": "pahan",
        "name": "Pahan Sarathchandra",
        "twitterHandle": "@pahans"
      },
      comments: []
    },
    {
      "_id": "2f6b59fd0b182dc6e2f0051696c70d70",
      "title": "Understanding Mean, Histogram and Percentiles",
      "author": {
        "_id": "arunoda",
        "name": "Arunoda Susiripala",
        "twitterHandle": "@arunoda"
      },
      "comments": [
        {
          "_id": "cid-19710666",
          "replies": [
            {
              "_id": "cid-37250492",
              "content": "Thank You!"
            },
            {
              "_id": "cid-2617133",
              "content": "If you need more information, just contact me."
            }
          ]
        },
        {
          "_id": "cid-8221034",
          "replies": [
            {
              "_id": "cid-37250492",
              "content": "Thank You!"
            },
            {
              "_id": "cid-2617133",
              "content": "If you need more information, just contact me."
            }
          ]
        }
      ]
    }
  ],
  "again": [
    {
      "_id": "03390abb5570ce03ae524397d215713b",
      "title": "New Feature: Tracking Error Status with Kadira",
      "author": {
        "_id": "pahan",
        "name": "Pahan Sarathchandra",
        "twitterHandle": "@pahans"
      },
      comments: []
    },
    {
      "_id": "2f6b59fd0b182dc6e2f0051696c70d70",
      "title": "Understanding Mean, Histogram and Percentiles",
      "author": {
        "_id": "arunoda",
        "name": "Arunoda Susiripala",
        "twitterHandle": "@arunoda"
      },
      "comments": [
        {
          "_id": "cid-19710666",
          "content": "This is a very good blog post",
          "replies": [
            {
              "_id": "cid-37250492",
              "content": "Thank You!"
            },
            {
              "_id": "cid-2617133",
              "content": "If you need more information, just contact me."
            }
          ]
        },
        {
          "_id": "cid-8221034",
          "content": "Keep up the good work",
          "replies": [
            {
              "_id": "cid-37250492",
              "content": "Thank You!"
            },
            {
              "_id": "cid-2617133",
              "content": "If you need more information, just contact me."
            }
          ]
        }
      ]
    }
  ]
};
