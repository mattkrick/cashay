export const front3Query = `
query {
  getRecentPosts(first:3) {
    _id,
    cursor
  }
}`;

export const front4Query = `
query {
  getRecentPosts(first:4) {
    _id,
    cursor
  }
}`;

export const front3Response = {
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
      }
    ]
  }
};

export const front3LocalResponseFn = (requestAmount) => {
  const base = {

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
        }
      ]
    }
  };
  base.data.getRecentPosts.BOF = true;
  base.data.getRecentPosts.EOF = true;
  if (requestAmount !== undefined) {
    base.data.getRecentPosts.count = requestAmount;
  }
  return base;
};

export const front3Store = {
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
      }
    }
  },
  "result": {
    "getRecentPosts": {
      front: [
        "PostType::p126",
        "PostType::p125",
        "PostType::p124"
      ]
    }
  }
};

export const front2After3Query = `
query {
  getRecentPosts(first:2, afterCursor: "1422222222222chikachikow") {
    _id,
    cursor
  }
}`;

export const front1After3Response = {
  "data": {
    "getRecentPosts": [
      {
        "_id": "p123",
        "cursor": "1411111111111chikachikow"
      }
    ]
  }
};

export const front2After3StoreFn = () => {
  const base = {
    "entities": {
      "PostType": {
        "p123": {
          "_id": "p123",
          "cursor": "1411111111111chikachikow"
        }
      }
    },
    "result": {
      "getRecentPosts": {
        "front": [
          "PostType::p123"
        ]
      }
    }
  };
  base.result.getRecentPosts.front.EOF = true;
  // base.result.getRecentPosts.front.count = 1;
  return base;
};

export const front1After3Store = {
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
      front: [
        "PostType::p123"
      ]
    }
  }
};

export const front1After4Query = `
query {
  getRecentPosts(first:1, afterCursor: "1411111111111chikachikow") {
    _id,
    cursor
  }
}`;

export const front1After4Response = {
  "data": {
    "getRecentPosts": []
  }
};

export const front1After4StoreFn = () => {
  const base = {
    "entities": {},
    "result": {
      "getRecentPosts": {
        "front": []
      }
    }
  };
  base.result.getRecentPosts.front.EOF = true;
  return base;
};

export const back1After4StoreFn = () => {
  const base = {
    "entities": {},
    "result": {
      "getRecentPosts": {
        "back": []
      }
    }
  };
  base.result.getRecentPosts.back.EOF = true;
  return base;
};
