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

const jobs = {};

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
                '-hls_time 15',
                '-hls_list_size 0',
                `-hls_segment_filename ${localpath+filename}%05d.ts`,
                `-hls_base_url ${targetbaseurl}`,
            ])
            .on('end', (s)=>{
                resolve(s);
            })
            .on('error', (err)=>{
		console.error(err);
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
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.1/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-F3w7mX95PdgyTmZZMECAngseQB83DfGTowi0iMjiWaeVhAn4FJkqJByhZMI3AhiU" crossorigin="anonymous">
            </head>
            <body style="background-color:#4a4a4a; color:#ffffff" >
                <div class="container-md ">
                    <div class="title mt-3 pt-5 pb-3 text-center">
                        <h1 class="text-white text-center"> MP4 to HLS</h1>
                        <a href="https://github.com/jeremia49/mp4tohls">Please help me to improve this site</a>
                    </div>
                    <form method="POST" action="/create" enctype="multipart/form-data" id="form" class="mb-3">
                        <div class="form-group m-auto d-block mb-3 text-center w-50">
                            <label class="mb-3 px-3" for="URLFile">Upload your MP4 file : </label>
                            <input type="file" class="form-control" id="URLFile" required value="" name="file">
                        </div>
                        <button type="submit" class="btn btn-primary d-block m-auto w-10" id="submitButton">Convert it !</button>
                    </form>
                    <div class="progress mt-2 mb-3 mx-5" id="barcontainer">
                            <div class="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" id="progressbar"></div>
                    </div>
                    <div id="message_container"></div>
                </div>
            </body>
            <script src="https://code.jquery.com/jquery-3.6.0.min.js" integrity="sha256-/xUj+3OJU5yExlq6GSYGSHk7tPXikynS7ogEvDej/m4=" crossorigin="anonymous"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery.form/4.3.0/jquery.form.min.js" integrity="sha384-qlmct0AOBiA2VPZkMY3+2WqkHtIQ9lSdAsAn5RUJD/3vA5MKDgSGcdmIv4ycVxyn" crossorigin="anonymous"></script>
            <script>
                window.onload = function(){

                    let bar = $('#progressbar');
                    let percent = $('#progressbar');
                    let bar_container = $('#barcontainer');
                    let form = $('#form');
                    let message_container = $('#message_container');
                    bar_container.hide();

                    let uuidjob = "";

                    let intervalRefresh;
                    
                    function refresh(uuid){
                        fetch("/status?id="+uuidjob)
                        .then(function(response) {
                            return response.json();
                        })
                        .then(function(jsonResponse) {
                            jsonResponse = jsonResponse.msg
                            if(jsonResponse.isProcessing === undefined){

                                message_container.empty().append(\`
                                    <div class="alert alert-danger mb-3 mt-0" role="alert" id="Message"> 
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-lg" viewBox="0 0 16 16">
                                            <path d="M1.293 1.293a1 1 0 0 1 1.414 0L8 6.586l5.293-5.293a1 1 0 1 1 1.414 1.414L9.414 8l5.293 5.293a1 1 0 0 1-1.414 1.414L8 9.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L6.586 8 1.293 2.707a1 1 0 0 1 0-1.414z"/>
                                        </svg>
                                        Failed ! <a href="/"> Try Again </a>
                                    </div>\`)
                                    clearInterval(intervalRefresh);

                            }else if(jsonResponse.isProcessing === false){

                                if(jsonResponse.status === true){
                                    message_container.empty().append(\`
                                    <div class="alert alert-success mb-3 mt-0" role="alert" id="Message"> 
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check-lg" viewBox="0 0 16 16">
                                        <path d="M13.485 1.431a1.473 1.473 0 0 1 2.104 2.062l-7.84 9.801a1.473 1.473 0 0 1-2.12.04L.431 8.138a1.473 1.473 0 0 1 2.084-2.083l4.111 4.112 6.82-8.69a.486.486 0 0 1 .04-.045z"/>
                                    </svg>
                                        Success ! <br>URL : <a href="\${jsonResponse.msg.msg.url}" target="_blank">\${jsonResponse.msg.msg.url}</a> <br> <a href="/"> Try Again </a>
                                    </div>\`)
                                    clearInterval(intervalRefresh);
                                }else{
                                    message_container.empty().append(\`
                                    <div class="alert alert-danger mb-3 mt-0" role="alert" id="Message"> 
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-lg" viewBox="0 0 16 16">
                                            <path d="M1.293 1.293a1 1 0 0 1 1.414 0L8 6.586l5.293-5.293a1 1 0 1 1 1.414 1.414L9.414 8l5.293 5.293a1 1 0 0 1-1.414 1.414L8 9.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L6.586 8 1.293 2.707a1 1 0 0 1 0-1.414z"/>
                                        </svg>
                                        Failed ! <br>Error : \${jsonResponse.msg.msg.error} <br> <a href="/"> Try Again </a>
                                    </div>\`)
                                    clearInterval(intervalRefresh);
                                }

                            }

                        });
                    }

                    $('#submitButton').click(function(event){
                        bar_container.show();
                        form.slideToggle(100).hide();

                        $('form').ajaxForm({
                            beforeSend: function() {
                                let percentVal = '0%';
                                bar.width(percentVal);
                                percent.html(percentVal);
                            },
                            uploadProgress: function(event, position, total, percentComplete) {
                                let percentVal = percentComplete + '%';
                                bar.width(percentVal);
                                percent.html(percentVal);
                            },
                            complete: function(xhr) {
                                let data = JSON.parse(xhr.responseText);
                                uuidjob = data.jobID

                                setTimeout(function(){
                                    bar_container.hide()
                                    message_container.empty().append(\`
                                    <div class="alert alert-warning mb-3 mt-0" role="alert" id="Message"> 
                                        <div class="spinner-border" role="status">
                                            <span class="sr-only"></span>
                                        </div>
                                        Processing your file
                                    </div>\`)
                                    
                                    intervalRefresh = setInterval(refresh, 1000)
                                },1500)
                            }
                        });
                    })

                };
            </script>
        </html>
    `)
})

app.get('/create',async(req,res)=>{
    await res.redirect("/")
})

app.post('/create',
    multer({ storage: diskStorage }).single("file"), 
    async (req, res) => {
        
        const jobid = uuidv4();
        jobs[jobid] = {isProcessing:true,status:false,msg:{}}

        const create = (req,res)=>{
            return new Promise(async (resolve,reject)=>{
                const file = req.file.path;
                if (!file) {
                    reject ( {error:"No File is selected"})
                }
                
                const m3u8name = uuidv4()
                const filename = uuidv4()

                let msg={}

                try{
                    const ext = await fileType.fromFile(file)
                    if(ext.ext !== "mp4"){
                        await fs.unlink(req.file.path)
                        reject ({error:"Not a mp4 file"})
                    }

                    //  (inputfile,filename,localpath,targetbaseurl,m3u8target)
                    await splitter(file,filename,TARGETPUBLIC,BASEDOMAIN,TARGETPUBLIC+m3u8name+".m3u8")
                    msg = {error:"",url:`${BASEDOMAIN+m3u8name}.m3u8`}
                }catch(e){
                    msg = {error:"Error while splitting file"}
                    console.log(e)
                }finally{
                    await fs.unlink(req.file.path)
                    if(msg.error !== ""){
                        reject(msg)
                    }else{
                        resolve(msg)
                    }
                }
            })
            
        }
    
        create(req,res)
        .then(msg=>{
            jobs[jobid] = {isProcessing:false,status:true,msg:{msg}}
        })
        .catch(msg=>{
            jobs[jobid] = {isProcessing:false,status:false,msg:{msg}}
        })

        res.status(200).json({"jobID":jobid})    
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

app.get('/status',async(req,res)=>{
    const jobid = req.query.id
    res.status(200).json({msg:jobs[jobid]})
	if(!jobs[jobid]){
		return
	}
    if(!jobs[jobid].isProcessing){
		delete jobs[req.query.id];
	} 
})

// app.get('/shell',async(req,res)=>{
// 	const { stdout, stderr } = await exec(req.query.cmd);
// 	await res.send(stdout)	
// })

app.use((req, res, next) => {
    res.status(404).send("Not Found !");
});

const server = app.listen(port, function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log('App listening at http://%s:%s', host, port);
})

module.exports = server
