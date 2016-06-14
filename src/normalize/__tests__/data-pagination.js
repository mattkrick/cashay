export const fullResponse = {
  "data": {
    "getRecentPosts": [
      {
        "_id": "p126",
        "cursor": "1444444444444chikachikow"
      },
      {
        "_id": "p125",
        "cursor": "1433333333333chikachikow"
      },
      {
        "_id": "p124",
        "cursor": "1422222222222chikachikow"
      },
      {
        "_id": "p123",
        "cursor": "1411111111111chikachikow"
      }
    ]
  }
};

export const fullPostStore = {
  "entities": {
    "PostType": {
      "p126": {
        "_id": "p126",
        "cursor": "1444444444444chikachikow"
      },
      "p125": {
        "_id": "p125",
        "cursor": "1433333333333chikachikow"
      },
      "p124": {
        "_id": "p124",
        "cursor": "1422222222222chikachikow"
      },
      "p123": {
        "_id": "p123",
        "cursor": "1411111111111chikachikow"
      }
    }
  },
  "result": {
    "getRecentPosts": {
      "full": [
        "PostType::p126",
        "PostType::p125",
        "PostType::p124",
        "PostType::p123"
      ]
    }
  }
};

export const front4PostStore = {
  "entities": {
    "PostType": {
      "p126": {
        "_id": "p126",
        "cursor": "1444444444444chikachikow"
      },
      "p125": {
        "_id": "p125",
        "cursor": "1433333333333chikachikow"
      },
      "p124": {
        "_id": "p124",
        "cursor": "1422222222222chikachikow"
      },
      "p123": {
        "_id": "p123",
        "cursor": "1411111111111chikachikow"
      }
    }
  },
  "result": {
    "getRecentPosts": {
      "front": [
        "PostType::p126",
        "PostType::p125",
        "PostType::p124",
        "PostType::p123"
      ]
    }
  }
};

export const back4PostStore = {
  "entities": {
    "PostType": {
      "p126": {
        "_id": "p126",
        "cursor": "1444444444444chikachikow"
      },
      "p125": {
        "_id": "p125",
        "cursor": "1433333333333chikachikow"
      },
      "p124": {
        "_id": "p124",
        "cursor": "1422222222222chikachikow"
      },
      "p123": {
        "_id": "p123",
        "cursor": "1411111111111chikachikow"
      }
    }
  },
  "result": {
    "getRecentPosts": {
      "back": [
        "PostType::p126",
        "PostType::p125",
        "PostType::p124",
        "PostType::p123"
      ]
    }
  }
};

export const back1Query = `
query {
  getRecentPosts(last:1) {
    _id,
    cursor
  }
}`;

export const back1Skip1Query = `
query {
  getRecentPosts(last:1, beforeCursor:"1411111111111chikachikow") {
    _id,
    cursor
  }
}`;

export const back1Store = {
  entities: {
    PostType: {
      p123: {
        _id: "p123",
        cursor: "1411111111111chikachikow"
      }
    }
  },
  result: {
    getRecentPosts: {
      back: [
        "PostType::p123"
      ]
    }
  }
};

export const back1StoreNoCursor = {
  entities: {
    PostType: {
      p123: {
        _id: "p123"
      }
    }
  },
  result: {
    getRecentPosts: {
      back: [
        "PostType::p123"
      ]
    }
  }
};

export const back1NoCursorDenormalizedFn = () => {
  const base = {
    "getRecentPosts": [
      {
        "_id": "p123",
        "cursor": null
      }
    ]
  };
  base.getRecentPosts.BOF = true;
  base.getRecentPosts.EOF = true;
  base.getRecentPosts.count = 1;
  return base;
};

export const front3Back1Store = {
  "entities": {
    "PostType": {
      "p126": {
        "_id": "p126",
        "cursor": "1444444444444chikachikow"
      },
      "p125": {
        "_id": "p125",
        "cursor": "1433333333333chikachikow"
      },
      "p124": {
        "_id": "p124",
        "cursor": "1422222222222chikachikow"
      },
      "p123": {
        "_id": "p123",
        "cursor": "1411111111111chikachikow"
      }
    }
  },
  result: {
    getRecentPosts: {
      back: [
        "PostType::p123"
      ],
      front: [
        "PostType::p126",
        "PostType::p125",
        "PostType::p124"
      ]
    }
  }
};

export const back1QueryBadArgs = `
query {
  getRecentPosts(last:1, afterCursor:"foo") {
    _id,
    cursor
  }
}`;

export const front1After3DenormalizedFn = (requestAmount) => {
  const base = {
    data: {
      "getRecentPosts": [
        {
          "_id": "p123",
          "cursor": "1411111111111chikachikow"
        }
      ]
    }
  };
  base.data.getRecentPosts.EOF = true;
  if (requestAmount !== undefined) {
    base.data.getRecentPosts.count = requestAmount;
  }
  return base;
};

export const front4PostStoreNoCursors = {
  "entities": {
    "PostType": {
      "p126": {
        "_id": "p126"
      },
      "p125": {
        "_id": "p125"
      },
      "p124": {
        "_id": "p124"
      },
      "p123": {
        "_id": "p123"
      }
    }
  },
  "result": {
    "getRecentPosts": {
      "front": [
        "PostType::p126",
        "PostType::p125",
        "PostType::p124",
        "PostType::p123"
      ]
    }
  }
};

export const back4PostStoreNoLastCursor = {
  "entities": {
    "PostType": {
      "p126": {
        "_id": "p126"
      },
      "p125": {
        "_id": "p125",
        "cursor": "1433333333333chikachikow"
      },
      "p124": {
        "_id": "p124",
        "cursor": "1422222222222chikachikow"
      },
      "p123": {
        "_id": "p123",
        "cursor": "1411111111111chikachikow"
      }
    }
  },
  "result": {
    "getRecentPosts": {
      "back": [
        "PostType::p126",
        "PostType::p125",
        "PostType::p124",
        "PostType::p123"
      ]
    }
  }
};
