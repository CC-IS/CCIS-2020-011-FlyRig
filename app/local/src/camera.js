const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path.replace('.asar','.asar.unpacked');

console.log(ffmpegPath);

obtain(['fs','fluent-ffmpeg', 'path'], (fs, ffmpeg, path)=> {
  ffmpeg.setFfmpegPath(path.resolve(ffmpegPath));

  console.log(fs);
  if (!customElements.get('cam-era')) {

    class Camera extends HTMLElement {
      constructor() {
        super();

        this.options = {
          video: {
            width: {min: 640, ideal: 1920 },
            height: {min: 480, ideal: 1080 },
            frameRate: {exact: 30}
          }
        }

        this.metadata = {
          foo: "bar",
          bar: "foo",
          far: 'boo'
        };

        this.addMet = '';

        this.filePath = '';

        this.baseName = '';
      }

      clear() {
        //this.recorder.clearRecordedData();
      }

      record() {
        this.isRecording = true;
        this.recordedChunks = [];
        this.recorder.start();
        this.recordTime = 0;
        this.startTime = Date.now();
      }

      stop() {
        var _this = this;
        if(_this.isRecording){
          _this.isRecording = false;
          _this.recorder.stop();
          this.recordTime = Date.now() - _this.startTime;
        }
      }

      play() {
        this.video.play();
        //this.tempVideo.play();
      }

      pause() {
        this.video.stop();
        //this.tempVideo.stop();
      }

      getSourceNames(cb) {
        navigator.mediaDevices.enumerateDevices().then(cb);
      }

      setSourceFromLabel(label) {
        var _this = this;
        return navigator.mediaDevices.enumerateDevices().then(dev=>{
          _this.options.deviceId = dev.find(dev=>dev.label == label).deviceId;
        });

      }

      init(cb) {
        var _this = this;
        if (navigator.getUserMedia) {
          console.log(_this.options);
          navigator.getUserMedia( _this.options, cb, (error)=>console.log(error.code));
          console.log('after get user mdeia')
        }
      }

      blobToBuffer(blob){
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsArrayBuffer(blob);
            reader.onloadend = () => { resolve(Buffer.from(reader.result)); };
            reader.onerror = (ev) => { reject(ev.error); };
        });
      }

      onDataAvailable (blob){
        //this.makeDownload(blob);
        var _this = this;
        _this.blobToBuffer(blob).then(_this.saveFile.bind(_this));
        //this.addMetadata(blob).then(_this.saveFile);
      }

      onSaveProgress(perc){

      }

      onSaveEnd(){

      }

      beforeSave(){

      }

      addMetadata (blob){
        // var _this = this;
        // const decoder = new Decoder();
        //
        // // load webm blob and inject metadata
        // return _this.blobToBuffer(blob).then((buffer) => {
        //     decoder.on('data', chunk => console.log(chunk));
        //     decoder.write(buffer);
        // });
      }


      saveFile(buffer){
        var _this = this;
        _this.beforeSave();
        console.log('saving');
        var basePath = path.join(_this.filePath, _this.baseName);
        var inter = path.join(__dirname,'../../../intermediate.webm').replace('.asar','.asar.unpacked');
        console.log(basePath);
        console.log(inter);
        fs.writeFile(inter,buffer,'base64',(e)=>{
          if(!e){
            console.log("convert")
            var command = ffmpeg(inter).noAudio().videoCodec('copy');//.fps(30)

            // for (var key in _this.metadata) {
            //   if (_this.metadata.hasOwnProperty(key)) {
            //     command.outputOptions('-metadata', `"${key}"="${_this.metadata[key]}"`);
            //   }
            // }

            command.on('stderr', function(stderrLine) {
              console.log('Stderr output: ' + stderrLine);
            });

            command.on('progress', function(progress) {
              var perc = (Date.parse("15 Jan 1987 "+progress.timemark) - Date.parse("15 Jan 1987 00:00:00")) / _this.recordTime;
              _this.onSaveProgress(perc);
            });

            command.on('end', function() {
              _this.onSaveEnd();
              console.log('Finished processing');
            })


            command.save(`${basePath.replace(/\/:|-|\./g,'_')}_${(new Date()).toISOString().replace(/:|-|\./g,'_')}.mp4`);
            var csv = '';
            csv += _this.addMet;
            for (var key in _this.metadata) {
              if (_this.metadata.hasOwnProperty(key)) {
                csv+=`"${key}","${_this.metadata[key]}"\n`;
              }
            }
            fs.writeFileSync(`${basePath.replace(/\/:|-|\./g,'_')}_${(new Date()).toISOString().replace(/:|-|\./g,'_')}.csv`, csv);
          }
        });

      }

      makeDownload(blob){
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        document.body.appendChild(a);
        a.style = "display: none";
        a.href = url;
        a.download = `${this.baseName}_${(new Date()).toISOString()}.webm`;
        a.click();
        window.URL.revokeObjectURL(url);
      }

      startStream(cb){
        var _this = this;
        _this.init((stream)=> {
          console.log("here");
          _this.stream = stream;

          _this.video.srcObject = _this.stream;

          let track = stream.getVideoTracks()[0];
          let consts = track.getConstraints();

          if(consts.brightness) console.log("brightness");

          console.log(consts);

          _this.overlayCB = ()=>{};

          _this.video.addEventListener('loadedmetadata', ()=> {

            //_this.canvas.width = _this.tempVideo.videoWidth;
            //_this.canvas.height = _this.tempVideo.videoHeight;

            _this.play();

            var frames = 0;
            //var startTime = Date.now();

            // clearInterval(_this.canvInt);
            // _this.canvInt = setInterval(()=>{
            //   //frames++;
            //   //console.log(1000 * frames/(Date.now() - startTime));
            //   _this.ctx.drawImage(_this.tempVideo,0,0,_this.canvas.width, this.canvas.height);
            //
            // },1000/_this.options.video.frameRate.exact);
            //
            // _this.stream = _this.canvas.captureStream(_this.options.video.frameRate.exact);

            // _this.video.srcObject = _this.stream;
            // _this.video.play();

            this.recordedChunks = [];

            var options = {
              mimeType: "video/webm; codecs=h264", //vp9
              //videoBitsPerSecond: 2 * 1024 * 1024,
            };
            _this.recorder = new MediaRecorder(_this.stream, options);

            this.recorder.ondataavailable = event=>{
              if (event.data.size > 0) {
                  this.recordedChunks.push(event.data);
                  let blob = new Blob(this.recordedChunks, {
                    type: "video/webm"
                  });
                _this.onDataAvailable(blob);
              }
            };

            if(cb) cb();
          });

        });
      }

      connectedCallback() {
        //register events, check contents, etc.
        var _this = this;

        _this.onRecordEnd = (blob)=> {};

        if (!_this.shadowRoot) {
          _this.root = _this.attachShadow({ mode: 'open' });

          _this.root.innerHTML = `<style> @import "css/camera.css";</style>`;

          _this.video = µ('+video', _this.root);
          //_this.tempVideo = µ('+video', _this.root);
          //_this.tempVideo.display = "none";
          _this.canvas = µ('+canvas', _this.root);
          _this.ctx = _this.canvas.getContext('2d');

        }
      };
    };

    customElements.define('cam-era', Camera);
  }

  exports.Camera = customElements.get('cam-era');

  provide(exports);
});
