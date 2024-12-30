import multer from 'multer'; 
import FormData from 'form-data';

import request from 'request';
import fetch from 'node-fetch';

import fs from 'fs';

import express from 'express';
const app = express();

const port = 3000
const apiUrl = 'https://api.edenai.run/v2/workflow/9c7ef864-8d59-4ebf-87c6-3fde471dc10b/execution/'
import useErrorTemplate from './error.mjs';

async function startExecution(url) {
  const form = new FormData();
  var fName = encodeURIComponent(url || 'default-image.png');
  
  if (!fs.existsSync('./temp')) fs.mkdirSync('./temp');
  
  if (fName === 'default-image.png') {
    fs.copyFileSync(`./default-image.png`, `./temp/${fName}`)
  }
  if (!fs.existsSync(`./temp/${fName}`)) {
    request(url).pipe(fs.createWriteStream(`./temp/${fName}`))
  }


  form.append('file', fs.createReadStream(`./temp/${fName}`), fName);
  var response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      ...form.getHeaders(), // Add FormData headers
      'Authorization': `Bearer ${process.env.TOKEN}`
    },
    body: form
  })
  var json = await response.json()
  return json
}

async function getExecution(id) {
  const response = await fetch(`${apiUrl}/${id}`.replaceAll('//', '/'), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.TOKEN}`
    },
  })
  const result = await response.json();
  return result
}

async function getExecutionUntilFound(id, res, i) {
  const result = getExecution(id);

  if (!result.content) result.content = {};
  if (!result.content.status) result.content.status = 'error';

  if (i > 60) {
    res.status(408).send(useErrorTemplate(408, `Session Timeout, please try again later.`))
    return
  }

  switch (result.content.status) {
    case 'succeded':
      res.status(200).send(result.content.result.results.image__background_removal);
      break;
    case 'processing': 
      setTimeout(() => getExecutionUntilFound(id, res, i++), 5000);
      break
    default:
      res.send(result);
  }
}

var storage = multer.diskStorage({
  destination: function (req, file, callback) {

    // Uploads is the Upload_folder_name
    callback(null, 'temp')
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

    callback('Error: File upload only supports the following filetypes - ' + filetypes, null);
  }
  // mypic is the name of file attribute
}).single('image');

app.get('/', (req, res) => {
  res.redirect('/remove');
})

app.get('/remove', async (req, res) => {
  var execution = await startExecution(req.query.url)
  getExecutionUntilFound(execution.id, res, 1)
});

app.get('/startExecution', async (req, res) => {
  var execution = await startExecution(req.query.url)
  res.json(execution)
});

app.get('/getExecution', async (req, res) => {
  var result = await getExecution(req.query.id)
  switch (result.content.status) {
    case 'succeded':
      res.status(200).json(result.content.result.results.image__background_removal);
      break;
    case 'processing': 
      res.json(result.content)
      break
    default:
      res.json(result);
  }
});

app.get('/upload', (req, res) => {
  res.sendFile('/upload.html', { root: '.' });
});

app.post('/uploadFile', (req, res) => {
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

app.get('*', (req, res) =>{
  var path = req.path
  if (path.startsWith('/')) path = path.slice(1)
  if (path.endsWith('/')) path = path.slice(0, -1)
  if (!path.includes('.')) path = `${path}.html`
  if (!fs.existsSync(`./${path}`)) {
    useErrorTemplate(404, `Page not found: ${path}`)
    return
  }
  res.sendFile(path, {root: '.'})
})

app.listen(port, () => {
  console.log(`App listening on port ${port} (http://localhost:${port})!`);
});