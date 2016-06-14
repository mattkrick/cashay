export const back3Query = `
query {
  getRecentPosts(last:3) {
    _id,
    cursor
  }
}`;

export const back3Response = {
  "data": {
    "getRecentPosts": [
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
}

export const back3Store = {
  "entities": {
    "PostType": {
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
        "PostType::p125",
        "PostType::p124",
        "PostType::p123"
      ]
    }
  }
};

export const back2After3Query = `
query {
  getRecentPosts(last:2, beforeCursor: "1433333333333chikachikow") {
    _id,
    cursor
  }
}`;

export const back1After3Response = {
  "data": {
    "getRecentPosts": [
      {
        "_id": "p126",
        "cursor": "1444444444444chikachikow"
      }
    ]
  }
}

export const back2After3StoreFn = () => {
  const base = {
    "entities": {
      "PostType": {
        "p126": {
          "_id": "p126",
          "cursor": "1444444444444chikachikow"
        }
      }
    },
    "result": {
      "getRecentPosts": {
        "back": [
          "PostType::p126"
        ]
      }
    }
  }
  base.result.getRecentPosts.back.BOF = true;
  return base;
};

export const back4 = `
query {
  getRecentPosts(last:4) {
    _id,
    cursor
  }
}`;

export const back1After3Store = {
  "entities": {
    "PostType": {
      "p126": {
        "_id": "p126",
        "cursor": "1444444444444chikachikow"
      }
    }
  },
  "result": {
    "getRecentPosts": {
      "back": [
        "PostType::p126"
      ]
    }
  }
};

export const back1After4Query = `
query {
  getRecentPosts(last:1, beforeCursor: "1444444444444chikachikow") {
    _id,
    cursor
  }
}`;

export const back1After4Response = {
  "data": {
    "getRecentPosts": []
  }
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
  base.result.getRecentPosts.back.BOF = true;
  return base;
};

export const back4ResponseFn = (requestAmount) => {
  const base = {
    data: {
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
  base.data.getRecentPosts.BOF = true;
  base.data.getRecentPosts.EOF = true;
  if (requestAmount !== undefined) {
    base.data.getRecentPosts.count = requestAmount;
  }
  return base;
};

