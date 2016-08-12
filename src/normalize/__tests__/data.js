export const emptyInitialState = {
  entities: {},
  result: {}
};

export const paginationWords = {
  first: 'first',
  last: 'last',
  before: 'beforeCursor',
  after: 'afterCursor'
};

export const coerceTypes = {
  DateTime: val => new Date(val)
};

export const queryWithSortedArgs = `
query ($reverse: Boolean, $lang: String) {
  getLatestPost {
    _id
		title(inReverse: $reverse, language: $lang)
  }
}`;

export const responseFromSortedArgs = {
  "data": {
    "getLatestPost": {
      "_id": "p126",
      "title": "!LONAPSE NE ?atad dezilamroned erots yahsac seod woH"
    }
  }
};

export const storeFromSortedArgs = {
  "entities": {
    "PostType": {
      "p126": {
        "_id": "p126",
        "title": {
          "{\"inReverse\":true,\"language\":\"spanish\"}": "!LONAPSE NE ?atad dezilamroned erots yahsac seod woH"
        }
      }
    }
  },
  "result": {
    "getLatestPost": "PostType::p126"
  }
};

export const queryPostCount = `
  query {
    postCount: getPostCount
  }`;

export const storedPostCount = {
  "result": {
    "getPostCount": 4
  }
};
