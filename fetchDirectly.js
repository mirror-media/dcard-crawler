fs = require('fs');

const target = ["https://www.dcard.tw/service/api/v2/posts/230605247/comments?limit=100&after=0",
  "https://www.dcard.tw/service/api/v2/posts/231312570/comments?limit=100&after=0",
  "https://www.dcard.tw/service/api/v2/posts/231312570/comments?limit=100&after=100",
  "https://www.dcard.tw/service/api/v2/posts/233719419/comments?limit=100&after=0",
  "https://www.dcard.tw/service/api/v2/posts/233719419/comments?limit=100&after=100",
  "https://www.dcard.tw/service/api/v2/posts/234735342/comments?limit=100&after=0",
  "https://www.dcard.tw/service/api/v2/posts/234874161/comments?limit=100&after=0",
  "https://www.dcard.tw/service/api/v2/posts/235116193/comments?limit=100&after=0",
  "https://www.dcard.tw/service/api/v2/posts/235116193/comments?limit=100&after=100",
  "https://www.dcard.tw/service/api/v2/posts/235116193/comments?limit=100&after=200",
  "https://www.dcard.tw/service/api/v2/posts/235116193/comments?limit=100&after=300",
  "https://www.dcard.tw/service/api/v2/posts/235116193/comments?limit=100&after=400",
  "https://www.dcard.tw/service/api/v2/posts/235116193/comments?limit=100&after=500",
  "https://www.dcard.tw/service/api/v2/posts/235116193/comments?limit=100&after=600",
  "https://www.dcard.tw/service/api/v2/posts/235429492/comments?limit=100&after=0",
  "https://www.dcard.tw/service/api/v2/posts/235429492/comments?limit=100&after=100",
  "https://www.dcard.tw/service/api/v2/posts/235429492/comments?limit=100&after=200"]


const regexPost = /^.*posts\/(\d+)\/.*after=(\d)+$/

const fetch = require('node-fetch')
for (let i = 0; i < target.length; i++) {
  let match = target[i].match(regexPost)
  let filename = match[1] + '.after.' + match[2] + '.json'
  fetch(target[i]).then(response => {
    if (!response.ok) {
      throw response.status
    } else {
      return response.text()
    }
  }).then(text => {
    fs.writeFile(filename, text)
  })
}