const CommentList = [
  {
    _id: "cid-" + Math.ceil(Math.random() * 99999999),
    content: "This is a very good blog post",
    author: "pahan"
  },

  {
    _id: "cid-" + Math.ceil(Math.random() * 99999999),
    content: "Keep up the good work",
    author: "indi"
  }
];

const ReplyList = [
  {
    _id: "cid-" + Math.ceil(Math.random() * 99999999),
    content: "Thank You!",
    author: "arunoda"
  },

  {
    _id: "cid-" + Math.ceil(Math.random() * 99999999),
    content: "If you need more information, just contact me.",
    author: "arunoda"
  },
];

export default {
  CommentList,
  ReplyList
};