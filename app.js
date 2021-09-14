const express = require('express');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const fileType = require('file-type');
const cors = require('cors');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

const VALIDHTTPREGEX = '(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})'

const FFMPEGPATH = 'C:\\ffmpeg-4.4-full_build\\bin\\ffmpeg.exe'
if(!FFMPEGPATH) ffmpeg.setFfmpegPath(FFMPEGPATH)

const TARGETDOWNLOAD = "C:\\Users\\jerem\\Documents\\Project\\mp4tohls\\temp\\"
const TARGETPUBLIC = "C:\\Users\\jerem\\Documents\\Project\\mp4tohls\\public\\hls\\"
const BASEDOMAIN = "http://localhost:3000/hls/"

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
const port = 3000;

app.use(cors())

app.use(express.static(path.join(__dirname, 'public')))


app.get("/", (req, res)=>{
    res.send(`
        <html>
            <head>
                <title>MP4 to HLS</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.1/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-F3w7mX95PdgyTmZZMECAngseQB83DfGTowi0iMjiWaeVhAn4FJkqJByhZMI3AhiU" crossorigin="anonymous">
            </head>
            <body style="background-color:#4a4a4a; color:#ffffff" >
                <div class="container-md ">
                    <div class="title mt-3 pt-5 pb-3">
                        <h1 class="text-white text-center"> MP4 to HLS</h1>
                    </div>
                    <form method="POST" action="/create">
                        <div class="form-group m-auto d-block mb-3 text-center w-50">
                            <label class="mb-3 px-3" for="URLFile">MP4 URL : </label>
                            <input type="text" class="form-control" id="URLFile" required placeholder="https://example.com/video.mp4" value="" name="url">
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

app.use(express.urlencoded());
app.post('/create', async (req, res) => {

    const create = async (req,res)=>{
        let message = ""
        const filename = uuidv4();

        let url = req.body.url
        if ( checkValid(url)){
            if(!url.startsWith("http")){
                url = "https://"+url
            }

            try{
                const data = await getData(url)
                await fs.writeFile(TARGETDOWNLOAD+filename+".mp4",data.data)
            }catch{
                message = {error:"Failed to download the file"}
                return message
            }

        }else{
            message =  {error:"Unvalid URL"}
            return message
        }
        
        const m3u8name = uuidv4()

        try{          
            //  (inputfile,filename,localpath,targetbaseurl,m3u8target)
            await splitter(TARGETDOWNLOAD+filename+".mp4",filename,TARGETPUBLIC,BASEDOMAIN,TARGETPUBLIC+m3u8name+".m3u8")
            message = {error:"",url:`${BASEDOMAIN+m3u8name}.m3u8`}
        }catch(e){
            message = {error:"Error while splitting file",msg:e}
            console.log(e)
        }
        
        await fs.unlink(TARGETDOWNLOAD+filename+".mp4")

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
                    <div class="title mt-3 pt-5 pb-3">
                        <h1 class="text-white text-center"> MP4 to HLS</h1>
                    </div>
                    <div class="alert alert-danger mb-3 mt-0" role="alert">
                        ${msg.error}
                    </div>
                    <form method="POST" action="/create">
                        <div class="form-group m-auto d-block mb-3 text-center w-50">
                            <label class="mb-3 px-3" for="URLFile">MP4 URL : </label>
                            <input type="text" class="form-control" required id="URLFile" placeholder="https://example.com/video.mp4" value="" name="url">
                        </div>
                        <button type="submit" class="btn btn-primary d-block m-auto w-10">Convert it !</button>
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
                    <div class="title mt-3 pt-5 pb-3">
                        <h1 class="text-white text-center"> MP4 to HLS</h1>
                    </div>
                    <div class="alert alert-success mb-3 mt-0" role="alert">
                        M3U8 URL : <a href="${msg.url}" target="_blank">${msg.url}</a>
                    </div>
                    <form method="POST" action="/create">
                        <div class="form-group m-auto d-block mb-3 text-center w-50">
                            <label class="mb-3 px-3" for="URLFile">MP4 URL : </label>
                            <input type="text" class="form-control" id="URLFile" required placeholder="https://example.com/video.mp4" value="" name="url">
                        </div>
                        <button type="submit" class="btn btn-primary d-block m-auto w-10">Convert it !</button>
                    </form>
                </div>

            </body>
        </html>
        `)
        return
    }

    
})


app.use((req, res, next) => {
    res.status(404).send("Not Found !");
});

app.listen(port)

