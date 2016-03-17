//state = {
//  entities: {
//    foodItems: {
//      'cheese123': {
//        id: 'cheese123',
//        title: 'Great cheese'
//      },
//      'noodles22': {
//        id: 'noodles22',
//        title: 'Good noodles',
//        ingredients: ['wheat23'],
//      }
//    },
//    ingredients: {
//      'wheat23': {
//        name: 'gluteny wheat'
//      }
//    }
//  },

  //GraphQL - on the server
  //Test case: get results 11 - 20 without knowing 1-10
//
//  getSomeFood({expired: false, orderBy: 'expirationDate',first: 3, /*after: 'cheese123'*/ }) {
//    resolve() {
//      return r.table('foodItems').between().limit(first).after('cheese123');
//      ['oil', 'pepper', 'cheese123']
//    }
//  };
//
//
//{expired: false, orderBy: 'expirationDate', }
//
//  result: {
//    // args = {expired, orderBy, first, last, after, before, skip} the last 4 are removed from the keys
//    // since they are reserved pagination words
//    getSomeFood: {
//      // non-pagination args stored as the map KEY
//      "{expired: false, orderBy: 'expirationDate'}": {
//        // only used if 'after' or 'first' is an arg
//        front: [undefined, undefined, undefined, 'cheese123'],
//        // only used if 'before' or 'last' is an arg
//        //back: [undefined, undefined, 'noodles22', 'cheese123'],
//        // when front & back converge, they are replaced with a 'full' array & 'hasNextPage' becomes true
//        //full: [undefined, undefined, undefined, 'cheese123', 'noodles22', undefined, undefined],
//        //  hasNextPage: false
//      }
//    },
//    // All food does does not require pagination (since it's ALL)
//    getAllFood: {
//      "{orderBy: 'expirationDate'}": {
//        full: ['foodItem:pizza', 'pie', 'lemons', 'cheese123', 'noodles22', 'queso', 'chorizo']
//      }
//    },
//    // A single item is presented as on object, not an array
//    getFirstFoodItem: {
//      "noArgs": 'pizza',
//      "{expired: true}": 'foodItems:noodles22'
//    },
//    getLastFoodItem: {
//      "noArgs": 'chorizo'
//    }
//  }
//};

//1 query has many argsStrs
//if type is scalar
//  1 argStr has a scalar
//if type is an object
//  1 argStr has an id
//if type is an array
//  if query has 'first'
//    1 pageArgs has front
//  if query has 'last'
//    1 pageArgs has back
//  else
//    1 pageArgs has full
//exclude unions for now
//
