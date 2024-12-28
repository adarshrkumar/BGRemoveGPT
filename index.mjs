import FormData from 'form-data';

import request from 'request';
import fetch from 'node-fetch';

import fs from 'fs';

import express from 'express';
const app = express();

const url = "https://api.edenai.run/v2/workflow/9c7ef864-8d59-4ebf-87c6-3fde471dc10b/execution/"

import useErrorTemplate from './error.mjs';

async function getExecution(id, res, i) {
  const response = await fetch(`${url}/${id}`.replaceAll('//', '/'), {
    headers: {
      "Content-Type": "application/json",
      'Authorization': `Bearer ${process.env.TOKEN}`
    },
  })
  const result = await response.json();

  if (!result.content) result.content = {};
  if (!result.content.status) result.content.status = 'error';

  if (i > 60) {
    res.status(408).send(useErrorTemplate(408, `Session Timeout, please try again later.\nYou can get the execution again on its own by using the /getExecution endpoint with the id of the execution which is "${id}"`))
    return
  }

  switch (result.content.status) {
    case 'succeded':
      res.send(result.content.result.results.image__background_removal);
      break;
    case 'processing': 
      setTimeout(() => getExecution(id, res, i++), 5000);
      break
    default:
      res.send(result);
  }
}

var storage = multer.diskStorage({
  destination: function (req, file, callback) {

    // Uploads is the Upload_folder_name
    callback(null, "temp")
  },
  filename: function (req, file, callback) {
    fName = file.originalname
    callback(null, file.originalname)
  }
})

// Define the maximum size for uploading
// picture i.e. 1 MB. it is optional
const maxSize = 1000 * 1000 * 1000;

var upload = multer({
  storage: storage,
  limits: { fileSize: maxSize },
  fileFilter: function (req, file, callback) {

    // Set the filetypes, it is optional
    var filetypes = /jpeg|jpg|png|webp|gif/;
    var mimetype = filetypes.test(file.mimetype);

    var extname = path.extname(file.originalname).toLowerCase()
    extname = filetypes.test(extname);

    if (mimetype && extname) {
      fName = file.originalname
      return callback(null, fName);
    }

    callback("Error: File upload only supports the " + "following filetypes - " + filetypes, null);
  }
  // mypic is the name of file attribute
}).single("image");

app.get('/', async (req, res) => {
  const form = new FormData();
  var fName = decodeURIComponent(req.query.url || 'default-image.png');

  if (!fs.existsSync('./temp')) fs.mkdirSync('./temp');

  if (fName === 'default-image.png') {
    fs.copyFileSync(`./default-image.png`, `./temp/${fName}`)
  }
  if (!fs.existsSync(fs.createWriteStream(`./temp/${fName}`))) {
    request(url).pipe(fs.createWriteStream(`./temp/${fName}`))
  }


  form.append('file', fs.createReadStream(`./temp/${fName}`), fName);

  await fetch(url, {
    method: 'POST',
    headers: {
      ...form.getHeaders(), // Add FormData headers
      'Authorization': `Bearer ${process.env.TOKEN}`
    },
    body: form
  })
    .then(response => response.json())
    .then(json  => getExecution(json.id, res, 0))
});

app.get('/upload', (req, res) => {
  res.sendFile('/upload.html', { root: '.' });
});

app.post("/uploadFile",function (req, res) {
  // Error MiddleWare for multer file upload, so if any
  // error occurs, the image would not be uploaded!
  upload(req, res, function(err) {
    if(err) {
      // ERROR occurred (here it can be occurred due
      // to uploading image of size greater than
      // 1MB or uploading different file type)
      res.send(err)
    }
    else {
      // SUCCESS, image successfully uploaded
      // res.send(fName)
      var url = `/chat?`
      
      var hasParent = req.query.hasParent
      if (!!hasParent) url = `/upload?sucess=true&`
      
      url += `filelocation=temp-storage&name=${fName}`
      
      var p = req.query.p
      if (!!p) url += `&prompt=${p}`

      var t = req.query.t
      if (!!t) url += `&type=${t}`

      var isBulk = req.query.isBulk
      if (!!isBulk) url += `&isBulk=${isBulk}`
      
      res.redirect(url)
    }
  })
})

app.get('/getExecution', async (req, res) => {
  getExecution(req.query.id, res, 0)
});

app.get('/base64Upload', async (req, res) => {
  var fPath = decodeURIComponent(req.query.path) || 'error';
  var path = fPath.replaceAll('/', '_')
  var content = req.query.b64content

  if (!fs.existsSync('./temp')) fs.mkdirSync('./temp');

  if (fName !== 'error') fs.writeFileSync(`./temp/${path}.png`, content, 'base64')

  res.json({status: 'success', message: `Wrote to file "${fPath}" please use that as the url param please`})
});

app.get('*', function(req, res) {
  var path = req.path
  if (path.startsWith('/')) path = path.slice(1)
  if (path.endsWith('/')) path = path.slice(0, -1)
  if (!path.includes('.')) path = `${path}.html`
  if (!fs.existsSync(`./${path}`)) {
    path = '404.html'
  }
  res.sendFile(path, {root: '.'})
})

app.listen(3000, () => {
  console.log('Example app listening on port 3000!');
});