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
        "PostType:p126",
        "PostType:p125",
        "PostType:p124",
        "PostType:p123"
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
        "PostType:p126",
        "PostType:p125",
        "PostType:p124",
        "PostType:p123"
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
        "PostType:p126",
        "PostType:p125",
        "PostType:p124",
        "PostType:p123"
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
        "PostType:p123"
      ]
    }
  }
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
        "PostType:p123"
      ],
      front: [
        "PostType:p126",
        "PostType:p125",
        "PostType:p124"
      ]
    }
  }
};
