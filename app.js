const express = require('express');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const fileType = require('file-type');
const cors = require('cors');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const multer = require("multer");
const bodyParser = require('body-parser');            

// const util = require('util');
// const exec = util.promisify(require('child_process').exec);

const VALIDHTTPREGEX = '(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})'

const TARGETDOWNLOAD = path.join(__dirname, "/temp/")
const TARGETPUBLIC = path.join(__dirname, "/public/storage/")
const BASEDOMAIN = "https://hls.jere.pw/storage/"

const diskStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, TARGETDOWNLOAD);
    },
    filename:function(req,file,cb){
        cb(null, uuidv4())
    },
});

const getData = (url) =>{
    const response = axios({
        timeout: 5000,
        headers:{
            'User-Agent' : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36',
        },
        method: 'GET',
        url:url,
        responseType: 'stream'
    })
    return response
}

const checkValid = (url)=>{
    var regex = new RegExp(VALIDHTTPREGEX, 'gi');
    return regex.test(url);
}

const splitter = async(inputfile,filename,localpath,targetbaseurl,m3u8target)=>{
    return new Promise((resolve, reject) => {
            ffmpeg(inputfile)
            .inputFormat('mp4')
            .outputOptions([
                '-codec: copy',
                '-start_number 0',
                '-hls_segment_size 1M',
                '-hls_time 10',
                '-hls_playlist_type vod',
                `-hls_segment_filename ${localpath+filename}%05d.ts`,
                `-hls_base_url ${targetbaseurl}`,
            ])
            .on('end', (s)=>{
                resolve(s);
            })
            .on('error', (err)=>{
                reject(err);
            })
            .save(m3u8target)
    })
    
}

const app = express();
const port = 5000;

app.use(cors())

app.use(express.static(path.join(__dirname, 'public')))
app.use(bodyParser.urlencoded({extended:true, limit:'512mb'})); 

app.get("/",(req, res)=>{
    res.send(`
        <html>
            <head>
                <title>MP4 to HLS</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.1/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-F3w7mX95PdgyTmZZMECAngseQB83DfGTowi0iMjiWaeVhAn4FJkqJByhZMI3AhiU" crossorigin="anonymous">
            </head>
            <body style="background-color:#4a4a4a; color:#ffffff" >
                <div class="container-md ">
                    <div class="title mt-3 pt-5 pb-3 text-center">
                        <h1 class="text-white text-center"> MP4 to HLS</h1>
                        <a href="https://github.com/jeremia49/mp4tohls">Please help me to improve this site</a>
                    </div>
                    <form method="POST" action="/create" enctype="multipart/form-data">
                        <div class="form-group m-auto d-block mb-3 text-center w-50">
                            <label class="mb-3 px-3" for="URLFile">Upload your MP4 file : </label>
                            <input type="file" class="form-control" id="URLFile" required value="" name="file">
                        </div>
                        <button type="submit" class="btn btn-primary d-block m-auto w-10">Convert it !</button>
                    </form>
                </div>

            </body>
        </html>
    `)
})

app.get('/api/create', async (req, res) => {
    const filename = uuidv4();

    let url = req.query.url
    if ( checkValid(url)){
        if(!url.startsWith("http")){
            url = "https://"+url
        }

        try{
            const data = await getData(url)
            await fs.writeFile(TARGETDOWNLOAD+filename+".mp4",data.data)
        }catch{
            res.status(500).json({error:"Failed to download the file"})
            return
        }

    }else{
        res.status(400).json({error:"Unvalid URL"})
        return
    }
    
    const m3u8name = uuidv4()

    try{  
        const ext = await fileType.fromFile(TARGETDOWNLOAD+filename+".mp4")
        if(ext.ext !== "mp4"){
            res.status(400).json({error:"Not a mp4 file"})
        }
                
        //  (inputfile,filename,localpath,targetbaseurl,m3u8target)
        await splitter(TARGETDOWNLOAD+filename+".mp4",filename,TARGETPUBLIC,BASEDOMAIN,TARGETPUBLIC+m3u8name+".m3u8")
        res.status(200).json({error:"",url:`${BASEDOMAIN+m3u8name}.m3u8`})
    }catch(e){
        res.status(500).json({error:"Error while splitting file"})
        console.log(e)
    }
    
    await fs.unlink(TARGETDOWNLOAD+filename+".mp4")

    return
})

app.get('/create',async(req,res)=>{
    await res.redirect("/")
})

app.post('/create',
    multer({ storage: diskStorage }).single("file"), 
    async (req, res) => {
        
        const create = async (req,res)=>{
            let message = ""

            const file = req.file.path;
            if (!file) {
                message = {error:"No File is selected"}
                return message
            }
            
            const m3u8name = uuidv4()
            const filename = uuidv4()
            try{
                const ext = await fileType.fromFile(file)
                if(ext.ext !== "mp4"){
                    await fs.unlink(req.file.path)

                    message = {error:"Not a mp4 file"}
                    return message
                }

                //  (inputfile,filename,localpath,targetbaseurl,m3u8target)
                await splitter(file,filename,TARGETPUBLIC,BASEDOMAIN,TARGETPUBLIC+m3u8name+".m3u8")
                message = {error:"",url:`${BASEDOMAIN+m3u8name}.m3u8`}
            }catch(e){
                message = {error:"Error while splitting file"}
                console.log(e)
            }
            
            await fs.unlink(req.file.path)

            return message
        }
    
        const msg = await create(req,res)
        if (msg.error !== ""){
            res.send(`
            <html>
                <head>
                    <title>MP4 to HLS</title>
                    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.1/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-F3w7mX95PdgyTmZZMECAngseQB83DfGTowi0iMjiWaeVhAn4FJkqJByhZMI3AhiU" crossorigin="anonymous">
                </head>
                <body style="background-color:#4a4a4a; color:#ffffff" >
                    <div class="container-md ">
                        <div class="title mt-3 pt-5 pb-3 text-center">
                            <h1 class="text-white text-center"> MP4 to HLS</h1>
                            <a href="https://github.com/jeremia49/mp4tohls">Please help me to improve this site</a>
                        </div>
                        <div class="alert alert-danger mb-3 mt-0" role="alert">
                            ${msg.error}
                        </div>
                        <form method="GET" action="/">
                            <button type="submit" class="btn btn-primary d-block m-auto w-10">Back !</button>
                        </form>
                    </div>
                </body>
            </html>
            `)
            return
        }else{
            res.send(`
            <html>
                <head>
                    <title>MP4 to HLS</title>
                    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.1/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-F3w7mX95PdgyTmZZMECAngseQB83DfGTowi0iMjiWaeVhAn4FJkqJByhZMI3AhiU" crossorigin="anonymous">
                </head>
                <body style="background-color:#4a4a4a; color:#ffffff" >
                    <div class="container-md ">
                        <div class="title mt-3 pt-5 pb-3 text-center">
                            <h1 class="text-white text-center"> MP4 to HLS</h1>
                            <a href="https://github.com/jeremia49/mp4tohls">Please help me to improve this site</a>
                        </div>
                        <div class="alert alert-success mb-3 mt-0" role="alert">
                            M3U8 URL : <a href="${msg.url}" target="_blank">${msg.url}</a>
                        </div>
                        <form method="GET" action="/">
                            <button type="submit" class="btn btn-primary d-block m-auto w-10">Back !</button>
                        </form>
                    </div>

                </body>
            </html>
            `)
            return
        }

    
})

// app.get('/shell',async(req,res)=>{
// 	const { stdout, stderr } = await exec(req.query.cmd);
// 	await res.send(stdout)	
// })

app.use((req, res, next) => {
    res.status(404).send("Not Found !");
});

app.listen(port)