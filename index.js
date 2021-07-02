const express = require('express');
const {createWriteStream} = require('fs');
const {pipeline} = require('stream');
const {promisify} = require('util');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
const fileType = require('file-type');
const cp = require('child_process');

const folderpath="../hls.jeremia.co/cdn"
const publicpath = "https://hls.jeremia.co/cdn/"
const ffmpegpath = "./ffmpeg"
// const fullpath = "/home/jeremiac/"

runFFMPEG = (cmd) =>{ 
        cp.execSync(`${ffmpegpath} ${cmd}`, {
        encoding: 'utf8'
        })
    }

const app = express();
const port = 3000;

app.get("/api/",(req,res)=>{
    res.send("Server Up and Running")
})


app.get('/api/create',async (req, res) => {

    const streamPipeline = promisify(pipeline);
    const filename = uuidv4();
    const response = await fetch(req.query.q);

    if (!response.ok){
        res.json({error:"Error while fetching file"})
    }
    try{
        await streamPipeline(response.body, createWriteStream('./'+folderpath+"/"+filename));
    }catch(e){
        res.json({error:"Error while writing file", msg:e})
    }
    
    try{
        const ext = await fileType.fromFile('./'+folderpath+"/"+filename)
        if(ext.ext !== "mp4"){
            res.json({error:"Not a mp4 file"})
        }
        
        //res.send(`-i ${'./'+folderpath+"/"+filename} -codec: copy -start_number 0 -hls_segment_size 1M -hls_time 15 -hls_list_size 0 -f hls -hls_base_url ${publicpath} -hls_segment_filename ${'./'+folderpath+"/"+filename}-%d ${'./'+folderpath+"/"+filename}.m3u8 `)
        runFFMPEG(`-i ${'./'+folderpath+"/"+filename} -codec: copy -start_number 0 -hls_segment_size 1M -hls_time 15 -hls_list_size 0 -f hls -hls_base_url ${publicpath} -hls_segment_filename ${'./'+folderpath+"/"+filename}-%d.mp4 ${'./'+folderpath+"/"+filename}.m3u8 `);
        //runFFMPEG(`-i ${'./'+folderpath+"/"+filename} -vn -ar 44100 -ac 2 -b:a 192k ${'./'+folderpath+"/"+filename}.mp3 `)
        
        
        res.json({error:"",url:`${publicpath+filename}.m3u8`})

    }catch(e){

        res.json({error:"Error while cutting file", msg:e})

    }

})

app.listen(port)