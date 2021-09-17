const server = require('./app.js');
const request = require('supertest');
const requestWithSupertest = request(server);

let jobid = ""

jest.setTimeout(10000)

describe('Test Homepage', () => {

    it('GET /', async () => {
        const res = await requestWithSupertest.get('/');
        expect(res.status).toEqual(200);
        expect(res.type).toEqual(expect.stringContaining('text/html'));
    });
  
});

describe('Test converter from web', () => {

    it('POST /create - Create a job', async () => {
        const res = await requestWithSupertest.post('/create')
                        .attach('file', 'test/BigBuckBunny.mp4');
        expect(res.status).toEqual(200);
        expect(res.type).toEqual(expect.stringContaining('json'));
        jobid  = JSON.parse(res.text).jobID
        expect(jobid).not.toEqual("")
    });

    it('GET /status/:id - Check job status', async () => {

        const reload =  async ()=>{
            return await new Promise((resolve,reject)=>{
                let counter = 0;
                const interval = setInterval(async ()=>{
                    counter++;
                    const res = await requestWithSupertest.get(`/status?id=${jobid}&ref=${counter}`)
                    let response = JSON.parse(res.text)
                    response = response.msg
                    if(!response) return
                    if(!response.isProcessing){
                        clearInterval(interval)
                        if(response.status){
                            resolve(response)
                        }else{
                            reject(response)
                        }
                    }
                },1000)
            })
            
        }
        const response = await reload()
        expect(response.status).toEqual(true)
    });    
  
});

server.close()